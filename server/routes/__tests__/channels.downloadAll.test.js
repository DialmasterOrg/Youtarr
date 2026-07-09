/* eslint-env jest */

// channels.js requires these directly at factory top; mock them so requiring
// the route file does not pull in the real database.
jest.mock('../../modules/channelSettingsModule', () => ({
  validateSubFolder: jest.fn().mockReturnValue({ valid: true }),
}));
jest.mock('../../models/channelvideo', () => ({}));

const express = require('express');
const createChannelRoutes = require('../channels');
const { findRouteHandler } = require('../../__tests__/testUtils');

const PREVIEW_PATH = '/api/channels/:channelId/download-all/preview';
const DOWNLOAD_PATH = '/api/channels/:channelId/download-all';

const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
};

const createResponse = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const buildDeps = () => ({
  verifyToken: (req, res, next) => next(),
  channelModule: {},
  archiveModule: {},
  channelDownloadAllModule: {
    getPreview: jest.fn(),
    startDownloadAll: jest.fn(),
  },
  // Real ratingMapper: pure module, exercises actual rating validation.
  ratingMapper: require('../../modules/ratingMapper'),
});

const getHandler = (method, path, deps) => {
  const router = createChannelRoutes(deps);
  const app = express();
  app.use(express.json());
  app.use(router);
  return findRouteHandler(app, method, path);
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/channels/:channelId/download-all/preview', () => {
  test('returns the preview for the requested tab', async () => {
    const deps = buildDeps();
    const preview = { count: 3, totalDurationSeconds: 150, missingDurations: 1 };
    deps.channelDownloadAllModule.getPreview.mockResolvedValue(preview);

    const handler = getHandler('get', PREVIEW_PATH, deps);
    const req = { params: { channelId: 'UC123' }, query: { tabType: 'shorts' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.channelDownloadAllModule.getPreview).toHaveBeenCalledWith('UC123', 'shorts');
    expect(res.json).toHaveBeenCalledWith(preview);
  });

  test('defaults to the videos tab when tabType is absent', async () => {
    const deps = buildDeps();
    deps.channelDownloadAllModule.getPreview.mockResolvedValue({
      count: 0,
      totalDurationSeconds: 0,
      missingDurations: 0,
    });

    const handler = getHandler('get', PREVIEW_PATH, deps);
    const req = { params: { channelId: 'UC123' }, query: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.channelDownloadAllModule.getPreview).toHaveBeenCalledWith('UC123', 'videos');
  });

  test('rejects an invalid tabType', async () => {
    const deps = buildDeps();

    const handler = getHandler('get', PREVIEW_PATH, deps);
    const req = { params: { channelId: 'UC123' }, query: { tabType: 'bogus' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid tabType' });
    expect(deps.channelDownloadAllModule.getPreview).not.toHaveBeenCalled();
  });

  test('returns 404 for an unknown channel', async () => {
    const deps = buildDeps();
    deps.channelDownloadAllModule.getPreview.mockRejectedValue(new Error('CHANNEL_NOT_FOUND'));

    const handler = getHandler('get', PREVIEW_PATH, deps);
    const req = { params: { channelId: 'UCmissing' }, query: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Channel not found' });
  });

  test('returns 500 on unexpected errors', async () => {
    const deps = buildDeps();
    deps.channelDownloadAllModule.getPreview.mockRejectedValue(new Error('db exploded'));

    const handler = getHandler('get', PREVIEW_PATH, deps);
    const req = { params: { channelId: 'UC123' }, query: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to compute download-all preview' });
    expect(loggerMock.error).toHaveBeenCalled();
  });
});

describe('POST /api/channels/:channelId/download-all', () => {
  test('starts the download and returns 202 with the queued count', async () => {
    const deps = buildDeps();
    deps.channelDownloadAllModule.startDownloadAll.mockResolvedValue({ queued: 42 });

    const handler = getHandler('post', DOWNLOAD_PATH, deps);
    const req = {
      params: { channelId: 'UC123' },
      body: { tabType: 'videos', overrideSettings: { resolution: '720' } },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(deps.channelDownloadAllModule.startDownloadAll).toHaveBeenCalledWith(
      'UC123',
      'videos',
      { resolution: '720' }
    );
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ status: 'accepted', queued: 42 });
  });

  test('passes empty settings when overrideSettings is absent', async () => {
    const deps = buildDeps();
    deps.channelDownloadAllModule.startDownloadAll.mockResolvedValue({ queued: 1 });

    const handler = getHandler('post', DOWNLOAD_PATH, deps);
    const req = { params: { channelId: 'UC123' }, body: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(deps.channelDownloadAllModule.startDownloadAll).toHaveBeenCalledWith(
      'UC123',
      'videos',
      {}
    );
  });

  test('rejects invalid overrideSettings', async () => {
    const deps = buildDeps();

    const handler = getHandler('post', DOWNLOAD_PATH, deps);
    const req = {
      params: { channelId: 'UC123' },
      body: { overrideSettings: { resolution: '999' } },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid overrideSettings' });
    expect(deps.channelDownloadAllModule.startDownloadAll).not.toHaveBeenCalled();
  });

  test('rejects an invalid tabType', async () => {
    const deps = buildDeps();

    const handler = getHandler('post', DOWNLOAD_PATH, deps);
    const req = { params: { channelId: 'UC123' }, body: { tabType: 'nope' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid tabType' });
  });

  test('returns 404 for an unknown channel', async () => {
    const deps = buildDeps();
    deps.channelDownloadAllModule.startDownloadAll.mockRejectedValue(
      new Error('CHANNEL_NOT_FOUND')
    );

    const handler = getHandler('post', DOWNLOAD_PATH, deps);
    const req = { params: { channelId: 'UCmissing' }, body: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Channel not found' });
  });

  test('returns 500 on unexpected errors', async () => {
    const deps = buildDeps();
    deps.channelDownloadAllModule.startDownloadAll.mockRejectedValue(new Error('boom'));

    const handler = getHandler('post', DOWNLOAD_PATH, deps);
    const req = { params: { channelId: 'UC123' }, body: {}, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to start channel download-all' });
    expect(loggerMock.error).toHaveBeenCalled();
  });
});
