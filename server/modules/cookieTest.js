const fs = require('fs');
const os = require('os');
const path = require('path');
const logger = require('../logger');
const configModule = require('./configModule');
const ytDlpRunner = require('./ytDlpRunner');
const YtdlpCommandBuilder = require('./download/ytdlpCommandBuilder');
const { getExternalCookiesPath, getExternalCookiesStatus } = require('./externalCookies');
const { classifyYtdlpError, ERROR_CODES } = require('./subscriptionImport/errorClassifier');

const COOKIE_TEST_TIMEOUT_MS = 60 * 1000;
// The subscriptions feed only renders for a signed-in session, so it doubles
// as a logged-in probe. One entry is enough; an empty feed still means success.
const SUBSCRIPTIONS_FEED_URL = 'https://www.youtube.com/feed/channels';
const PROBE_ARGS = ['--flat-playlist', '--skip-download', '-J', '--playlist-end', '1'];
// Signed out, yt-dlp cannot find the feed's page data and gives up with these
// warnings (verified with yt-dlp 2026.09.16). For other URLs they can mean an
// outdated yt-dlp, which is why this check stays specific to the feed.
const NOT_SIGNED_IN_PATTERN = /Incomplete yt initial data received|unable to extract yt initial data/i;
// Matches both apostrophes yt-dlp prints; the shared classifier only matches "you are".
const BOT_CHECK_PATTERN = /sign in to confirm.*not a bot/i;
const INVALID_COOKIE_FILE = 'INVALID_COOKIE_FILE';
const IN_PROGRESS_CODE = 'COOKIE_TEST_IN_PROGRESS';
const SNAPSHOT_DIR_PREFIX = 'youtarr-cookie-test-';
const SNAPSHOT_FILE_MODE = 0o600;

const MESSAGES = {
  SUCCESS: 'YouTube accepted these cookies as a signed-in session.',
  [ERROR_CODES.EXPIRED_COOKIES]:
    'YouTube did not recognize a signed-in session. The cookies are expired, were rotated, or were exported from a signed-out browser. Export fresh cookies from a browser signed in to YouTube and replace the cookie file.',
  [ERROR_CODES.BOT_CHECK]:
    'YouTube is asking for verification on this account. Sign in to YouTube in your browser, solve any challenges, then export fresh cookies and try again.',
  [ERROR_CODES.NETWORK]:
    'Could not reach YouTube. Check the internet connection and proxy settings, then try again.',
  [ERROR_CODES.TIMEOUT]: 'YouTube did not respond within 60 seconds. Try again.',
  [ERROR_CODES.UNKNOWN]: 'yt-dlp could not complete the cookie test. Try again, and update yt-dlp if it keeps failing.',
};

// ytDlpRunner reports its own bot-check detection with this code.
const RUNNER_BOT_CHECK_CODE = 'COOKIES_REQUIRED';
const RUNNER_TIMEOUT_CODE = 'YTDLP_TIMEOUT';

function failure(code, error = MESSAGES[code]) {
  return { ok: false, code, error };
}

function classifyFailure(error) {
  if (error.code === RUNNER_TIMEOUT_CODE) return ERROR_CODES.TIMEOUT;
  if (error.code === RUNNER_BOT_CHECK_CODE) return ERROR_CODES.BOT_CHECK;

  const stderr = error.message || '';
  if (BOT_CHECK_PATTERN.test(stderr)) return ERROR_CODES.BOT_CHECK;
  const { code } = classifyYtdlpError(stderr);
  if (code !== ERROR_CODES.UNKNOWN) return code;
  return NOT_SIGNED_IN_PATTERN.test(stderr) ? ERROR_CODES.EXPIRED_COOKIES : ERROR_CODES.UNKNOWN;
}

// yt-dlp writes its cookie jar back to --cookies on exit. Probe a private copy
// of uploaded cookies so a test that finishes after "Replace file" or "Delete
// file" cannot restore the old cookies. External files already get a snapshot
// from spawnYtDlp.
function snapshotUploadedCookies(args) {
  const index = args.indexOf('--cookies');
  if (index < 0 || args[index + 1] === getExternalCookiesPath()) return { args, cleanup: () => {} };

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), SNAPSHOT_DIR_PREFIX));
  const cleanup = () => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (error) {
      logger.warn({ code: error.code }, 'Failed to remove cookie test snapshot');
    }
  };
  try {
    const snapshotPath = path.join(dir, 'cookies.txt');
    fs.copyFileSync(args[index + 1], snapshotPath);
    fs.chmodSync(snapshotPath, SNAPSHOT_FILE_MODE);
    const snapshotArgs = [...args];
    snapshotArgs[index + 1] = snapshotPath;
    return { args: snapshotArgs, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

class CookieTest {
  constructor() {
    this.running = false;
  }

  isBusyError(error) {
    return error?.code === IN_PROGRESS_CODE;
  }

  /**
   * Ask YouTube whether the active cookies still belong to a signed-in session.
   * Uses the same common args (proxy, IP family, cookies, cache dir) as downloads.
   * @returns {Promise<{ok: true, message: string}|{ok: false, code: string, error: string}>}
   * @throws {Error} with code COOKIE_TEST_IN_PROGRESS when a test is already running
   */
  async run() {
    if (this.running) {
      const error = new Error('A cookie test is already running.');
      error.code = IN_PROGRESS_CODE;
      throw error;
    }

    this.running = true;
    try {
      // Unusable external cookies are dropped from yt-dlp's args, which would
      // otherwise read as "signed out" instead of naming the file problem.
      if (getExternalCookiesPath()) {
        const external = getExternalCookiesStatus();
        if (!external.ready) return failure(INVALID_COOKIE_FILE, external.error);
      }

      const snapshot = snapshotUploadedCookies([
        ...YtdlpCommandBuilder.buildCommonArgs(configModule.getConfig(), { skipSleepRequests: true }),
        ...PROBE_ARGS,
        SUBSCRIPTIONS_FEED_URL,
      ]);

      let stdout;
      try {
        stdout = await ytDlpRunner.run(snapshot.args, { timeoutMs: COOKIE_TEST_TIMEOUT_MS });
      } catch (error) {
        const code = classifyFailure(error);
        // Never log stderr: yt-dlp echoes malformed cookie lines, values included.
        logger.warn({ code }, 'Cookie test failed');
        return failure(code);
      } finally {
        snapshot.cleanup();
      }

      try {
        JSON.parse(stdout);
      } catch {
        logger.warn('Cookie test returned output that is not JSON');
        return failure(ERROR_CODES.UNKNOWN);
      }
      logger.info('Cookie test succeeded');
      return { ok: true, message: MESSAGES.SUCCESS };
    } finally {
      this.running = false;
    }
  }
}

module.exports = new CookieTest();
