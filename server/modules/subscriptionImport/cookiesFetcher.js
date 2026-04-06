'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const logger = require('../../logger');
const { classifyYtdlpError, ERROR_CODES, USER_MESSAGES } = require('./errorClassifier');
const { COOKIES_FETCH_TIMEOUT_MS } = require('./constants');

const NETSCAPE_HEADER_PREFIX = '# Netscape HTTP Cookie File';
const TEMP_DIR_PREFIX = 'youtarr-subsimport-';
const COOKIES_FILENAME = 'cookies.txt';
const COOKIES_FILE_MODE = 0o600;
const YOUTUBE_CHANNELS_FEED_URL = 'https://www.youtube.com/feed/channels';
const CHANNEL_ID_PREFIX = 'UC';
const JSON_PREVIEW_MAX_LENGTH = 500;

class FetchError extends Error {
  constructor({ code, userMessage, details }) {
    super(userMessage);
    this.name = 'FetchError';
    this.code = code;
    this.userMessage = userMessage;
    this.details = details || '';
  }
}

/**
 * Check if a buffer starts with the Netscape HTTP Cookie File header.
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function isNetscapeFormat(buffer) {
  if (!Buffer.isBuffer(buffer)) return false;
  const header = buffer.toString('utf8', 0, NETSCAPE_HEADER_PREFIX.length);
  return header === NETSCAPE_HEADER_PREFIX;
}

/**
 * Run yt-dlp with the given cookies file and return the raw stdout/stderr.
 * Uses execFile (not exec) for security -- no shell interpretation.
 * @param {string} cookiesPath
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runYtdlp(cookiesPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '--cookies', cookiesPath,
      '--flat-playlist',
      '--skip-download',
      '-J',
      YOUTUBE_CHANNELS_FEED_URL,
    ];

    execFile('yt-dlp', args, { timeout: COOKIES_FETCH_TIMEOUT_MS }, (error, stdout, stderr) => {
      if (error) {
        if (error.killed) {
          const classification = {
            code: ERROR_CODES.TIMEOUT,
            userMessage: USER_MESSAGES[ERROR_CODES.TIMEOUT],
            details: 'yt-dlp process was killed after timeout',
          };
          reject(new FetchError(classification));
          return;
        }
        const classification = classifyYtdlpError(stderr);
        reject(new FetchError(classification));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Parse yt-dlp JSON output, extract channel entries, validate, and deduplicate.
 * @param {string} stdout
 * @returns {Array<{channelId: string, title: string, url: string}>}
 */
function parseChannelEntries(stdout) {
  let data;
  try {
    data = JSON.parse(stdout);
  } catch (parseErr) {
    const preview = stdout ? stdout.slice(0, JSON_PREVIEW_MAX_LENGTH) : '(empty)';
    throw new FetchError({
      code: ERROR_CODES.UNKNOWN,
      userMessage: 'yt-dlp returned invalid JSON. This is unexpected -- please try again or use Google Takeout.',
      details: `JSON parse error: ${parseErr.message}. Output preview: ${preview}`,
    });
  }

  const entries = data.entries || [];
  const seen = new Set();
  const results = [];

  for (const entry of entries) {
    const channelId = entry.channel_id || entry.id;
    if (!channelId || !channelId.startsWith(CHANNEL_ID_PREFIX)) {
      logger.debug({ channelId, title: entry.title }, 'Skipping entry without valid UC channel ID');
      continue;
    }
    if (seen.has(channelId)) {
      continue;
    }
    seen.add(channelId);
    results.push({
      channelId,
      title: entry.title || '',
      url: entry.url || `https://www.youtube.com/channel/${channelId}`,
    });
  }

  return results;
}

/**
 * Fetch YouTube subscriptions using a one-time cookies buffer.
 * The cookies are written to a temp dir, used for a single yt-dlp call,
 * and always cleaned up afterward -- never stored permanently.
 *
 * @param {Buffer} buffer - A Netscape-format cookies.txt file
 * @returns {Promise<Array<{channelId: string, title: string, url: string}>>}
 * @throws {FetchError} on invalid format, yt-dlp errors, or no channels found
 */
async function fetchWithCookies(buffer) {
  if (!isNetscapeFormat(buffer)) {
    throw new FetchError({
      code: 'INVALID_FORMAT',
      userMessage: 'The uploaded file is not a valid Netscape-format cookies file. Please export cookies using a browser extension like "Get cookies.txt LOCALLY".',
    });
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
  const cookiesPath = path.join(tempDir, COOKIES_FILENAME);

  try {
    fs.writeFileSync(cookiesPath, buffer);
    fs.chmodSync(cookiesPath, COOKIES_FILE_MODE);

    logger.info({ tempDir }, 'Running yt-dlp with one-time cookies to fetch subscriptions');

    const { stdout } = await runYtdlp(cookiesPath);
    const channels = parseChannelEntries(stdout);

    if (channels.length === 0) {
      throw new FetchError({
        code: ERROR_CODES.NO_CHANNELS_FOUND,
        userMessage: USER_MESSAGES[ERROR_CODES.NO_CHANNELS_FOUND],
      });
    }

    logger.info({ channelCount: channels.length }, 'Successfully fetched subscriptions via cookies');
    return channels;
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      logger.debug({ tempDir }, 'Cleaned up temp cookies directory');
    } catch (cleanupErr) {
      logger.error({ err: cleanupErr, tempDir }, 'Failed to clean up temp cookies directory');
    }
  }
}

module.exports = { fetchWithCookies, FetchError, isNetscapeFormat };
