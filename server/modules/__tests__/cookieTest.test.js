/* eslint-env jest */
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../logger', () => ({ warn: jest.fn(), info: jest.fn(), debug: jest.fn(), error: jest.fn() }));
jest.mock('../ytdlpProcess', () => ({ spawnYtDlp: jest.fn() }));
jest.mock('../download/tempPathManager', () => ({ getTempBasePath: jest.fn(() => '/tmp/youtarr') }));
jest.mock('../configModule', () => ({ getConfig: jest.fn(() => ({ proxy: 'http://proxy:8080' })) }));
jest.mock('../download/ytdlpCommandBuilder', () => ({ buildCommonArgs: jest.fn() }));
jest.mock('../externalCookies', () => ({
  getExternalCookiesPath: jest.fn(() => null),
  getExternalCookiesStatus: jest.fn(),
}));

const COOKIE_CONTENTS = '# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tvalue\n';
const FEED_URL = 'https://www.youtube.com/feed/channels';
const NOT_SIGNED_IN_STDERR = [
  'WARNING: [youtube:tab] unable to extract yt initial data; please report this issue on  https://github.com/yt-dlp/yt-dlp/issues?q= , filling out the appropriate issue template. Confirm you are on the latest version using  yt-dlp -U',
  'WARNING: [youtube:tab] Incomplete yt initial data received; please report this issue on  https://github.com/yt-dlp/yt-dlp/issues?q= , filling out the appropriate issue template. Confirm you are on the latest version using  yt-dlp -U. Giving up after 3 retries',
  'ERROR: [youtube:tab] channels: Failed to resolve url (does the playlist exist?)',
].join('\n');

class MockChildProcess extends EventEmitter {
  constructor() {
    super();
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
    this.killed = false;
    this.kill = jest.fn(() => { this.killed = true; });
  }

  finish({ stdout = '', stderr = '', code = 0 } = {}) {
    if (stdout) this.stdout.emit('data', Buffer.from(stdout));
    if (stderr) this.stderr.emit('data', Buffer.from(stderr));
    this.emit('close', code);
  }
}

describe('cookieTest', () => {
  let cookieTest;
  let spawnYtDlp;
  let externalCookies;
  let child;
  let uploadDir;
  let uploadedPath;

  const cookiesArg = () => {
    const args = spawnYtDlp.mock.calls[0][0];
    return args[args.indexOf('--cookies') + 1];
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cookie-test-spec-'));
    uploadedPath = path.join(uploadDir, 'cookies.user.txt');
    fs.writeFileSync(uploadedPath, COOKIE_CONTENTS);
    require('../download/ytdlpCommandBuilder').buildCommonArgs.mockReturnValue(
      ['-4', '--proxy', 'http://proxy:8080', '--cookies', uploadedPath]
    );
    spawnYtDlp = require('../ytdlpProcess').spawnYtDlp;
    spawnYtDlp.mockImplementation(() => {
      child = new MockChildProcess();
      return child;
    });
    externalCookies = require('../externalCookies');
    externalCookies.getExternalCookiesPath.mockReturnValue(null);
    cookieTest = require('../cookieTest');
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  test('requests the subscriptions feed with the common download args', async () => {
    const pending = cookieTest.run();
    child.finish({ stdout: JSON.stringify({ entries: [] }) });
    await pending;

    expect(spawnYtDlp.mock.calls[0][0]).toEqual([
      '-4', '--proxy', 'http://proxy:8080', '--cookies', expect.any(String),
      '--flat-playlist', '--skip-download', '-J', '--playlist-end', '1', FEED_URL,
    ]);
  });

  test('probes a private copy of uploaded cookies', async () => {
    const pending = cookieTest.run();

    expect(cookiesArg()).not.toBe(uploadedPath);
    expect(fs.readFileSync(cookiesArg(), 'utf8')).toBe(COOKIE_CONTENTS);
    child.finish({ stdout: '{}' });
    await pending;
  });

  test('keeps a replacement uploaded during the test', async () => {
    const pending = cookieTest.run();
    fs.writeFileSync(uploadedPath, 'replacement');
    fs.writeFileSync(cookiesArg(), 'jar written back by yt-dlp');
    child.finish({ stdout: '{}' });
    await pending;

    expect(fs.readFileSync(uploadedPath, 'utf8')).toBe('replacement');
  });

  test('removes the cookie snapshot after the test', async () => {
    const pending = cookieTest.run();
    child.finish({ stderr: 'ERROR: something new', code: 1 });
    await pending;

    expect(fs.existsSync(cookiesArg())).toBe(false);
  });

  test('passes an external cookie path through for spawnYtDlp to snapshot', async () => {
    externalCookies.getExternalCookiesPath.mockReturnValue(uploadedPath);
    externalCookies.getExternalCookiesStatus.mockReturnValue({ ready: true, error: null });
    const pending = cookieTest.run();
    child.finish({ stdout: '{}' });
    await pending;

    expect(cookiesArg()).toBe(uploadedPath);
  });

  test('never logs yt-dlp stderr, which can echo cookie values', async () => {
    const logger = require('../../logger');
    const pending = cookieTest.run();
    child.finish({ stderr: 'WARNING: skipping cookie file entry due to invalid length 5: SECRET', code: 1 });
    await pending;

    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('SECRET');
  });

  test('skips sleep-requests when building the common args', async () => {
    const YtdlpCommandBuilder = require('../download/ytdlpCommandBuilder');
    const pending = cookieTest.run();
    child.finish({ stdout: '{}' });
    await pending;

    expect(YtdlpCommandBuilder.buildCommonArgs).toHaveBeenCalledWith(expect.any(Object), { skipSleepRequests: true });
  });

  test('succeeds when the feed returns subscriptions', async () => {
    const pending = cookieTest.run();
    child.finish({ stdout: JSON.stringify({ entries: [{ id: 'UCabc', title: 'Channel' }] }) });

    await expect(pending).resolves.toEqual({ ok: true, message: expect.any(String) });
  });

  test('succeeds when a signed-in account has no subscriptions', async () => {
    const pending = cookieTest.run();
    child.finish({ stdout: JSON.stringify({ _type: 'playlist', id: 'channels', entries: [] }) });

    await expect(pending).resolves.toMatchObject({ ok: true });
  });

  test('reports EXPIRED_COOKIES when YouTube serves the signed-out feed', async () => {
    const pending = cookieTest.run();
    child.finish({ stderr: NOT_SIGNED_IN_STDERR, code: 1 });

    await expect(pending).resolves.toEqual({ ok: false, code: 'EXPIRED_COOKIES', error: expect.any(String) });
  });

  test('reports BOT_CHECK when YouTube asks for verification', async () => {
    const pending = cookieTest.run();
    child.finish({ stderr: 'ERROR: [youtube:tab] channels: Sign in to confirm you\'re not a bot.', code: 1 });

    await expect(pending).resolves.toMatchObject({ ok: false, code: 'BOT_CHECK' });
  });

  test('reports BOT_CHECK for the curly-apostrophe wording', async () => {
    const pending = cookieTest.run();
    child.finish({ stderr: 'ERROR: [youtube:tab] channels: Sign in to confirm you\u2019re not a bot.', code: 1 });

    await expect(pending).resolves.toMatchObject({ ok: false, code: 'BOT_CHECK' });
  });

  test('reports NETWORK when YouTube cannot be reached', async () => {
    const pending = cookieTest.run();
    child.finish({ stderr: 'ERROR: Unable to download webpage: getaddrinfo ENOTFOUND www.youtube.com', code: 1 });

    await expect(pending).resolves.toMatchObject({ ok: false, code: 'NETWORK' });
  });

  test('reports TIMEOUT when yt-dlp is killed for running too long', async () => {
    const pending = cookieTest.run();
    child.finish({ code: null });

    await expect(pending).resolves.toMatchObject({ ok: false, code: 'TIMEOUT' });
  });

  test('reports UNKNOWN for unrecognized failures', async () => {
    const pending = cookieTest.run();
    child.finish({ stderr: 'ERROR: something new', code: 1 });

    await expect(pending).resolves.toMatchObject({ ok: false, code: 'UNKNOWN' });
  });

  test('reports UNKNOWN when yt-dlp exits 0 without JSON', async () => {
    const pending = cookieTest.run();
    child.finish({ stdout: 'not json' });

    await expect(pending).resolves.toMatchObject({ ok: false, code: 'UNKNOWN' });
  });

  test('rejects a second test while one is running', async () => {
    const first = cookieTest.run();
    const second = cookieTest.run();

    const error = await second.catch((err) => err);
    expect(cookieTest.isBusyError(error)).toBe(true);
    child.finish({ stdout: '{}' });
    await first;
  });

  test('allows a new test after the previous one finishes', async () => {
    const first = cookieTest.run();
    child.finish({ stdout: '{}' });
    await first;

    const second = cookieTest.run();
    child.finish({ stdout: '{}' });
    await expect(second).resolves.toMatchObject({ ok: true });
  });

  test('reports an unusable external file without contacting YouTube', async () => {
    externalCookies.getExternalCookiesPath.mockReturnValue('/external/cookies.txt');
    externalCookies.getExternalCookiesStatus.mockReturnValue({
      ready: false,
      error: 'External cookies: the file was not found.',
    });

    await expect(cookieTest.run()).resolves.toEqual({
      ok: false,
      code: 'INVALID_COOKIE_FILE',
      error: 'External cookies: the file was not found.',
    });
    expect(spawnYtDlp).not.toHaveBeenCalled();
  });
});
