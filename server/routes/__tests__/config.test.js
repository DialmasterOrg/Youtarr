/* eslint-env jest */
jest.mock('../../modules/filenamePreview', () => ({
  previewTemplate: jest.fn(),
  validateTemplate: jest.fn().mockResolvedValue({ ok: true }),
}));

const express = require('express');
const supertest = require('supertest');

const createConfigRoutes = require('../config');
const filenamePreview = require('../../modules/filenamePreview');

const LOGGING_STATUS = {
  envLevel: 'info',
  file: { enabled: true, directory: '/app/config/logs', maxSizeBytes: 10485760, maxFiles: 5, error: null },
};

function makeApp() {
  const app = express();
  app.use(express.json());
  // Attach a minimal logger BEFORE routes so req.log is available in handlers
  app.use((req, _res, next) => {
    req.log = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    next();
  });
  const verifyToken = (req, _res, next) => next();
  const configModule = {
    _config: {
      passwordHash: 'hash',
      username: 'user',
      ytdlpLastChecked: null,
      ytdlpLastUpdated: null,
      ytdlpLastResult: null,
      rescanLastRun: null,
      videoFilenamePrefix: '%(uploader,channel,uploader_id).80B - %(title).76B',
    },
    getConfig: jest.fn(function () { return this._config; }),
    updateConfig: jest.fn(function (next) { this._config = next; }),
    getCookiesStatus: jest.fn(),
    getCookiesPath: jest.fn(() => null),
    isElfhostedPlatform: jest.fn(() => false),
    writeCustomCookiesFile: jest.fn(),
    deleteCustomCookiesFile: jest.fn(),
    getStorageStatus: jest.fn(),
    getImagePath: jest.fn(),
  };
  const validateEnvAuthCredentials = () => false;
  // No-op rate limiter for tests
  const filenamePreviewRateLimiter = (_req, _res, next) => next();
  const cookieTestRateLimiter = (_req, _res, next) => next();
  const cookieDetails = { getDetails: jest.fn(() => null) };
  const cookieTest = {
    run: jest.fn(),
    isBusyError: jest.fn((error) => error?.code === 'COOKIE_TEST_IN_PROGRESS'),
  };
  const getLoggingStatus = jest.fn(() => LOGGING_STATUS);
  app.use(createConfigRoutes({
    verifyToken,
    configModule,
    validateEnvAuthCredentials,
    isWslEnvironment: false,
    filenamePreviewRateLimiter,
    cookieDetails,
    cookieTest,
    cookieTestRateLimiter,
    getLoggingStatus,
  }));
  // eslint-disable-next-line no-unused-vars -- Express identifies error handlers by 4-arg arity.
  app.use((err, _req, res, _next) => {
    res.status(500).json({ error: err.message });
  });
  return { app, configModule, cookieDetails, cookieTest };
}

beforeEach(() => {
  filenamePreview.validateTemplate.mockReset();
  filenamePreview.validateTemplate.mockResolvedValue({ ok: true });
  filenamePreview.previewTemplate.mockReset();
});

describe('externally managed cookie routes', () => {
  let originalSource;
  beforeEach(() => {
    originalSource = process.env.YOUTARR_COOKIES_FILE;
    process.env.YOUTARR_COOKIES_FILE = '/external/cookies.txt';
  });
  afterEach(() => {
    if (originalSource === undefined) delete process.env.YOUTARR_COOKIES_FILE;
    else process.env.YOUTARR_COOKIES_FILE = originalSource;
  });

  test('rejects uploads without replacing saved cookies or enabling cookie use', async () => {
    const { app, configModule } = makeApp();
    const res = await supertest(app).post('/api/cookies/upload')
      .attach('cookieFile', Buffer.from('# Netscape HTTP Cookie File'), 'cookies.txt');
    expect(res.status).toBe(409);
    expect(configModule.writeCustomCookiesFile).not.toHaveBeenCalled();
  });

  test('rejects deletion without removing previously uploaded cookies', async () => {
    const { app, configModule } = makeApp();
    const res = await supertest(app).delete('/api/cookies');
    expect(res.status).toBe(409);
    expect(configModule.deleteCustomCookiesFile).not.toHaveBeenCalled();
  });
});

describe('GET /api/cookies/status', () => {
  const details = {
    loginCookiesFound: 10,
    sessionLoginCookies: 0,
    expiredLoginCookies: 0,
    earliestExpiry: '2027-10-19T03:13:08.000Z',
    earliestExpiryName: 'HSID',
    lastModified: '2026-09-18T22:40:30.384Z',
  };

  test('includes details for the active cookie file', async () => {
    const { app, configModule, cookieDetails } = makeApp();
    configModule.getCookiesStatus.mockReturnValue({ cookiesEnabled: true, customCookiesUploaded: true, customFileExists: true });
    configModule.getCookiesPath.mockReturnValue('/app/config/cookies.user.txt');
    cookieDetails.getDetails.mockReturnValue(details);

    const res = await supertest(app).get('/api/cookies/status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ cookiesEnabled: true, customCookiesUploaded: true, customFileExists: true, details });
    expect(cookieDetails.getDetails).toHaveBeenCalledWith('/app/config/cookies.user.txt');
  });

  test('returns null details when no cookie file is active', async () => {
    const { app, configModule } = makeApp();
    configModule.getCookiesStatus.mockReturnValue({ cookiesEnabled: false, customCookiesUploaded: false, customFileExists: false });

    const res = await supertest(app).get('/api/cookies/status');

    expect(res.body.details).toBeNull();
  });
});

describe('cookie upload and delete responses', () => {
  const details = { loginCookiesFound: 10, sessionLoginCookies: 0, expiredLoginCookies: 0,
    earliestExpiry: null, earliestExpiryName: null, lastModified: '2026-09-25T00:00:00.000Z' };

  test('upload returns cookie status with details for the new file', async () => {
    const { app, configModule, cookieDetails } = makeApp();
    configModule.getCookiesStatus.mockReturnValue({ cookiesEnabled: true, customCookiesUploaded: true, customFileExists: true });
    configModule.getCookiesPath.mockReturnValue('/app/config/cookies.user.txt');
    cookieDetails.getDetails.mockReturnValue(details);

    const res = await supertest(app).post('/api/cookies/upload')
      .attach('cookieFile', Buffer.from('# Netscape HTTP Cookie File\n'), 'cookies.txt');

    expect(res.status).toBe(200);
    expect(res.body.cookieStatus.details).toEqual(details);
  });

  test('delete returns cookie status with null details', async () => {
    const { app, configModule } = makeApp();
    configModule.getCookiesStatus.mockReturnValue({ cookiesEnabled: true, customCookiesUploaded: false, customFileExists: false });

    const res = await supertest(app).delete('/api/cookies');

    expect(res.status).toBe(200);
    expect(res.body.cookieStatus).toHaveProperty('details', null);
  });
});

describe('POST /api/cookies/test', () => {
  test('returns 400 when no cookie file is active', async () => {
    const { app, cookieTest } = makeApp();

    const res = await supertest(app).post('/api/cookies/test');

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
    expect(cookieTest.run).not.toHaveBeenCalled();
  });

  test('returns a successful test result with 200', async () => {
    const { app, configModule, cookieTest } = makeApp();
    configModule.getCookiesPath.mockReturnValue('/app/config/cookies.user.txt');
    cookieTest.run.mockResolvedValue({ ok: true, message: 'Signed in.' });

    const res = await supertest(app).post('/api/cookies/test');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, message: 'Signed in.' });
  });

  test('returns a failed test result with 200', async () => {
    const { app, configModule, cookieTest } = makeApp();
    configModule.getCookiesPath.mockReturnValue('/app/config/cookies.user.txt');
    cookieTest.run.mockResolvedValue({ ok: false, code: 'EXPIRED_COOKIES', error: 'Not signed in.' });

    const res = await supertest(app).post('/api/cookies/test');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, code: 'EXPIRED_COOKIES', error: 'Not signed in.' });
  });

  test('returns 409 while another test is running', async () => {
    const { app, configModule, cookieTest } = makeApp();
    configModule.getCookiesPath.mockReturnValue('/app/config/cookies.user.txt');
    cookieTest.run.mockRejectedValue(Object.assign(new Error('busy'), { code: 'COOKIE_TEST_IN_PROGRESS' }));

    const res = await supertest(app).post('/api/cookies/test');

    expect(res.status).toBe(409);
  });

  test('returns 500 when the test throws unexpectedly', async () => {
    const { app, configModule, cookieTest } = makeApp();
    configModule.getCookiesPath.mockReturnValue('/app/config/cookies.user.txt');
    cookieTest.run.mockRejectedValue(new Error('boom'));

    const res = await supertest(app).post('/api/cookies/test');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to run cookie test' });
  });
});

describe('POST /updateconfig', () => {
  test('returns 200 when ytdlpCustomArgs is empty', async () => {
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ ytdlpCustomArgs: '' });
    expect(res.status).toBe(200);
  });

  test('returns 200 when ytdlpCustomArgs contains only allowed flags', async () => {
    const { app, configModule } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ ytdlpCustomArgs: '--no-mtime --concurrent-fragments 4' });
    expect(res.status).toBe(200);
    expect(configModule.updateConfig).toHaveBeenCalled();
  });

  test('preserves managed rescanLastRun when saving settings', async () => {
    const { app, configModule } = makeApp();
    const rescanLastRun = {
      startedAt: '2026-05-04T15:00:00.000Z',
      completedAt: '2026-05-04T15:01:00.000Z',
      trigger: 'manual',
      status: 'completed',
      videosUpdated: 4,
      videosMarkedMissing: 1,
      videosScanned: 20,
      filesFoundOnDisk: 19,
      errorMessage: null
    };
    configModule._config.rescanLastRun = rescanLastRun;

    const res = await supertest(app)
      .post('/updateconfig')
      .send({ ytdlpCustomArgs: '', rescanLastRun: null });

    expect(res.status).toBe(200);
    expect(configModule.updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ rescanLastRun })
    );
  });

  test('returns 400 with the offending flag when ytdlpCustomArgs contains a denylisted flag', async () => {
    const { app, configModule } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ ytdlpCustomArgs: '--exec "rm -rf /"' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('--exec');
    expect(configModule.updateConfig).not.toHaveBeenCalled();
  });

  test('returns 400 on unterminated-quote parse error', async () => {
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ ytdlpCustomArgs: '--user-agent \'unterminated' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/parse error/i);
  });

  test('returns 400 when ytdlpCustomArgs exceeds 2000 characters', async () => {
    const { app } = makeApp();
    const longArgs = '--no-mtime '.repeat(200); // ~2200 chars
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ ytdlpCustomArgs: longArgs });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2000/);
  });

  test('returns 400 when ytdlpUpdateChannel is not a known channel', async () => {
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ ytdlpUpdateChannel: 'master' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ytdlpUpdateChannel/);
  });

  test('returns 200 and persists ytdlpUpdateChannel nightly', async () => {
    const { app, configModule } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ ytdlpUpdateChannel: 'nightly' });
    expect(res.status).toBe(200);
    expect(configModule.updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ ytdlpUpdateChannel: 'nightly' })
    );
  });

  describe('ytdlpDownloadRateLimit validation', () => {
    test.each(['', '5M', '500K', '1.5M', '2G', '1500'])(
      'returns 200 for valid rate limit %s',
      async (value) => {
        const { app, configModule } = makeApp();
        const res = await supertest(app)
          .post('/updateconfig')
          .send({ ytdlpDownloadRateLimit: value });
        expect(res.status).toBe(200);
        expect(configModule.updateConfig).toHaveBeenCalled();
      }
    );

    test.each(['5MB', '5 M', 'fast', '5.M', '5M/s'])(
      'returns 400 for invalid rate limit %s',
      async (value) => {
        const { app, configModule } = makeApp();
        const res = await supertest(app)
          .post('/updateconfig')
          .send({ ytdlpDownloadRateLimit: value });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/rate limit/i);
        expect(configModule.updateConfig).not.toHaveBeenCalled();
      }
    );
  });

  describe('logLevel validation', () => {
    test.each(['', 'warn', 'info', 'debug'])('accepts %p', async (value) => {
      const { app, configModule } = makeApp();
      const res = await supertest(app).post('/updateconfig').send({ logLevel: value });
      expect(res.status).toBe(200);
      expect(configModule.updateConfig).toHaveBeenCalled();
    });

    test.each(['DEBUG', 'trace', 'verbose', 5])('rejects %p without saving', async (value) => {
      const { app, configModule } = makeApp();
      const res = await supertest(app).post('/updateconfig').send({ logLevel: value });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Log level must be Default, Warn, Info or Debug' });
      expect(configModule.updateConfig).not.toHaveBeenCalled();
    });
  });

  test('does not save the read-only logging status', async () => {
    const { app, configModule } = makeApp();
    await supertest(app).post('/updateconfig').send({ logLevel: 'debug', logging: LOGGING_STATUS });
    expect(configModule.updateConfig.mock.calls[0][0]).not.toHaveProperty('logging');
  });

  describe('storage size validation', () => {
    const fields = ['downloadPauseUsageLimit', 'downloadPauseMinFreeSpace', 'autoRemovalUsageLimit'];

    test.each(fields.flatMap((field) => ['', '500MB', '50GB', '2TB'].map((value) => [field, value])))(
      'accepts %s = %p',
      async (field, value) => {
        const { app, configModule } = makeApp();
        const res = await supertest(app).post('/updateconfig').send({ [field]: value });
        expect(res.status).toBe(200);
        expect(configModule.updateConfig).toHaveBeenCalled();
      }
    );

    test.each(fields.flatMap((field) => ['0GB', '5 GB', '5gb', '1.5TB', 'lots', 500].map((value) => [field, value])))(
      'rejects %s = %p without saving',
      async (field, value) => {
        const { app, configModule } = makeApp();
        const res = await supertest(app).post('/updateconfig').send({ [field]: value });
        expect(res.status).toBe(400);
        expect(configModule.updateConfig).not.toHaveBeenCalled();
      }
    );

    test('names the rejected setting in the error', async () => {
      const { app } = makeApp();
      const res = await supertest(app).post('/updateconfig').send({ downloadPauseMinFreeSpace: 'lots' });
      expect(res.body).toEqual({
        error: 'Storage limits: minimum free space: use a whole number followed by MB, GB or TB (for example 500GB), or leave it blank',
      });
    });
  });
});

describe('POST /updateconfig - videoFilenamePrefix validation', () => {
  test('accepts the default prefix', async () => {
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ videoFilenamePrefix: '%(uploader,channel,uploader_id).80B - %(title).76B' });
    expect(res.status).toBe(200);
  });

  test('rejects an empty prefix with 400', async () => {
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ videoFilenamePrefix: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/empty/i);
  });

  test('rejects a whitespace-only prefix with 400', async () => {
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ videoFilenamePrefix: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/empty/i);
  });

  test('trims trailing whitespace before persisting', async () => {
    const { app, configModule } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ videoFilenamePrefix: '%(title).76B   ' });
    expect(res.status).toBe(200);
    expect(configModule.updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ videoFilenamePrefix: '%(title).76B' })
    );
  });

  test('rejects forward slash with 400', async () => {
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ videoFilenamePrefix: '%(uploader)s/%(title)s' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/path separator/i);
  });

  test('rejects backslash with 400', async () => {
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ videoFilenamePrefix: 'a\\b' });
    expect(res.status).toBe(400);
  });

  test('rejects path traversal .. with 400', async () => {
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ videoFilenamePrefix: '..%(title)s' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/traversal/i);
  });

  test('rejects ASCII control characters with 400', async () => {
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ videoFilenamePrefix: 'hello\x07world' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/control/i);
  });

  test('rejects non-string values with 400', async () => {
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ videoFilenamePrefix: {} });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/string/i);
  });

  test('rejects overlong values with 400', async () => {
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ videoFilenamePrefix: 'a'.repeat(161) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/160/);
  });

  // Template-grammar validation (conversion chars, format flags,
  // width/precision, yt-dlp-specific modifiers) is no longer enforced by this
  // route's regex parser; yt-dlp itself is the authority via the
  // filenamePreview module. The previous regex parser produced false
  // rejections for valid templates like %(view_count)05d and %(uploader)20s.
  test.each([
    ['zero-padded width %(view_count)05d', '%(uploader)s - %(view_count)05d - %(title).76B'],
    ['float conversion %(duration)f',     '%(uploader)s - %(duration)f - %(title).76B'],
    ['width without precision %(uploader)20s', '%(uploader)20s - %(title).76B'],
    ['hash modifier %(formats)#j',        '%(formats)#j - %(title).76B'],
    ['plus-S sanitize %(title)+S',        '%(title)+S'],
    ['truncation without conversion %(title).40', '%(uploader)s - %(title).40'],
    ['unescaped literal percent',         '100% done - %(title).76B'],
  ])('accepts %s without 400 (yt-dlp validates grammar at preview/save)', async (_label, prefix) => {
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ videoFilenamePrefix: prefix });
    expect(res.status).toBe(200);
  });

  test('returns 400 with yt-dlp stderr when filenamePreview rejects the template', async () => {
    filenamePreview.validateTemplate.mockResolvedValueOnce({
      ok: false,
      error: 'yt-dlp: error: invalid default output template "%(title)Z": unsupported format character \'Z\' (0x5a) at index 8',
    });
    const { app, configModule } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ videoFilenamePrefix: '%(title)Z' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unsupported format character/);
    expect(configModule.updateConfig).not.toHaveBeenCalled();
  });

  test('returns 400 and does not save when yt-dlp reports an incomplete format key', async () => {
    filenamePreview.validateTemplate.mockResolvedValueOnce({
      ok: false,
      error: 'yt-dlp: error: invalid default output template "%(title [%(id)s].%(ext)s": incomplete format key',
    });
    const { app, configModule } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ videoFilenamePrefix: '%(title' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/incomplete format key/);
    expect(configModule.updateConfig).not.toHaveBeenCalled();
  });

  test('blocks save with 400 on any filenamePreview failure (yt-dlp ships with the app)', async () => {
    filenamePreview.validateTemplate.mockResolvedValueOnce({
      ok: false,
      error: 'yt-dlp process timed out after 5000ms',
    });
    const { app, configModule } = makeApp();
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ videoFilenamePrefix: '%(title).76B' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/timed out/);
    expect(configModule.updateConfig).not.toHaveBeenCalled();
  });

  test('forwards unexpected save errors to Express error handling', async () => {
    const { app, configModule } = makeApp();
    configModule.updateConfig.mockImplementationOnce(() => {
      throw new Error('disk write failed');
    });

    const res = await supertest(app)
      .post('/updateconfig')
      .send({ ytdlpCustomArgs: '' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('disk write failed');
  });

  test('skips filenamePreview check when prefix is unchanged from current', async () => {
    const { app, configModule } = makeApp();
    const current = configModule._config.videoFilenamePrefix;
    const res = await supertest(app)
      .post('/updateconfig')
      .send({ videoFilenamePrefix: current });
    expect(res.status).toBe(200);
    expect(filenamePreview.validateTemplate).not.toHaveBeenCalled();
  });
});

describe('POST /api/config/filename-preview', () => {
  test('returns 200 with rendered file and folder lines for a valid prefix', async () => {
    filenamePreview.previewTemplate.mockResolvedValueOnce({
      fileLine: 'TEDx Talks - Sample [Hu4Yvq-g7_Y].mp4',
      folderLine: 'TEDx Talks - Sample - Hu4Yvq-g7_Y',
      fileLineLength: 38,
      folderLineLength: 33,
    });
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/api/config/filename-preview')
      .send({ prefix: '%(title).76B' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      fileLine: 'TEDx Talks - Sample [Hu4Yvq-g7_Y].mp4',
      folderLine: 'TEDx Talks - Sample - Hu4Yvq-g7_Y',
      fileLineLength: 38,
      folderLineLength: 33,
    });
    expect(filenamePreview.previewTemplate).toHaveBeenCalledWith('%(title).76B');
  });

  test('rejects empty prefix with 400 before invoking yt-dlp', async () => {
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/api/config/filename-preview')
      .send({ prefix: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/empty/i);
    expect(filenamePreview.previewTemplate).not.toHaveBeenCalled();
  });

  test('rejects path separators with 400', async () => {
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/api/config/filename-preview')
      .send({ prefix: '%(uploader)s/%(title)s' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/path separator/i);
    expect(filenamePreview.previewTemplate).not.toHaveBeenCalled();
  });

  test('rejects non-string prefix with 400', async () => {
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/api/config/filename-preview')
      .send({ prefix: 123 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/string/i);
  });

  test('returns 400 with yt-dlp stderr when yt-dlp rejects the template', async () => {
    filenamePreview.previewTemplate.mockRejectedValueOnce(new Error(
      'yt-dlp: error: invalid default output template "%(title)Z": unsupported format character \'Z\' (0x5a) at index 8'
    ));
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/api/config/filename-preview')
      .send({ prefix: '%(title)Z' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unsupported format character/);
  });

  test('returns 400 when yt-dlp reports an incomplete format key', async () => {
    filenamePreview.previewTemplate.mockRejectedValueOnce(new Error(
      'yt-dlp: error: invalid default output template "%(title [%(id)s].%(ext)s": incomplete format key'
    ));
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/api/config/filename-preview')
      .send({ prefix: '%(title' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/incomplete format key/);
  });

  test('returns 400 with yt-dlp message on timeout (yt-dlp ships with the app, so any failure blocks)', async () => {
    filenamePreview.previewTemplate.mockRejectedValueOnce(new Error(
      'yt-dlp process timed out after 5000ms'
    ));
    const { app } = makeApp();
    const res = await supertest(app)
      .post('/api/config/filename-preview')
      .send({ prefix: '%(title).76B' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/timed out/);
  });
});


describe('schedule configuration', () => {
  test.each([
    'invalid', '', null, 123, '0 25 * * *', '0 0 18 * * * extra',
    '1e1 * * * *', '1.5 * * * *', '0foo * * * *', '0 2 * Januaryfoo *',
  ])(
    'rejects an invalid frequency %p without saving other edits', async (value) => {
      const { app, configModule } = makeApp();
      const res = await supertest(app).post('/updateconfig').send({
        autoRemovalFrequency: value,
        channelDownloadFrequency: '0 18 * * *',
      });
      expect(res.status).toBe(400);
      expect(res.body.fieldErrors.autoRemovalFrequency).toEqual(expect.any(String));
      expect(configModule.updateConfig).not.toHaveBeenCalled();
    }
  );

  test('rejects a schedule that runs more often than the minimum interval', async () => {
    const { app, configModule } = makeApp();
    const res = await supertest(app).post('/updateconfig').send({
      channelDownloadFrequency: '*/5 * * * *',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Automatic downloads: must not run more often than every 15 minutes.');
    expect(configModule.updateConfig).not.toHaveBeenCalled();
  });

  test('field errors stand alone because the Scheduling card already shows the label', async () => {
    const { app } = makeApp();
    const res = await supertest(app).post('/updateconfig').send({
      channelDownloadFrequency: '*/5 * * * *',
      autoRemovalFrequency: 'invalid',
    });
    expect(res.body.fieldErrors).toEqual({
      channelDownloadFrequency: 'Must not run more often than every 15 minutes.',
      autoRemovalFrequency: 'Enter a valid cron expression.',
    });
  });

  test('preserves omitted schedules and backfills missing defaults', async () => {
    const { app, configModule } = makeApp();
    configModule._config.watchStatusSyncFrequency = '15 9 * * 1-5';
    const res = await supertest(app).post('/updateconfig').send({
      autoRemovalFrequency: '  0 18 * * *  ',
      channelDownloadFrequency: '0 15 9 * * 1-5',
      deploymentEnvironment: { timezone: 'untrusted' },
    });
    expect(res.status).toBe(200);
    expect(configModule._config).toEqual(expect.objectContaining({
      autoRemovalFrequency: '0 18 * * *',
      channelDownloadFrequency: '0 15 9 * * 1-5',
      watchStatusSyncFrequency: '15 9 * * 1-5',
      archiveBackfillFrequency: '20 2 * * *',
      videoRescanFrequency: '30 3 * * *',
      sessionCleanupFrequency: '0 3 * * *',
      ytdlpUpdateFrequency: '0 4 * * *',
    }));
    expect(configModule._config.deploymentEnvironment).toBeUndefined();
  });

  test('reports the server timezone as read-only deployment metadata', async () => {
    const { app } = makeApp();
    const res = await supertest(app).get('/getconfig');
    expect(res.status).toBe(200);
    expect(res.body.deploymentEnvironment.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  test('includes the logging status', async () => {
    const { app } = makeApp();
    const res = await supertest(app).get('/getconfig');
    expect(res.body.logging).toEqual(LOGGING_STATUS);
  });
});
