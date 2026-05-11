/* eslint-env jest */
jest.mock('../../modules/filenamePreview', () => ({
  previewTemplate: jest.fn(),
  validateTemplate: jest.fn().mockResolvedValue({ ok: true }),
}));

const express = require('express');
const supertest = require('supertest');

const createConfigRoutes = require('../config');
const filenamePreview = require('../../modules/filenamePreview');

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
    isElfhostedPlatform: jest.fn(() => false),
    writeCustomCookiesFile: jest.fn(),
    deleteCustomCookiesFile: jest.fn(),
    getStorageStatus: jest.fn(),
    getImagePath: jest.fn(),
  };
  const validateEnvAuthCredentials = () => false;
  // No-op rate limiter for tests
  const filenamePreviewRateLimiter = (_req, _res, next) => next();
  app.use(createConfigRoutes({
    verifyToken,
    configModule,
    validateEnvAuthCredentials,
    isWslEnvironment: false,
    filenamePreviewRateLimiter,
  }));
  // eslint-disable-next-line no-unused-vars -- Express identifies error handlers by 4-arg arity.
  app.use((err, _req, res, _next) => {
    res.status(500).json({ error: err.message });
  });
  return { app, configModule };
}

beforeEach(() => {
  filenamePreview.validateTemplate.mockReset();
  filenamePreview.validateTemplate.mockResolvedValue({ ok: true });
  filenamePreview.previewTemplate.mockReset();
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
