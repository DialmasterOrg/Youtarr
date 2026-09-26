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

const PATH = '/api/channels/:channelId/tab-stats';
const loggerMock = { info: jest.fn(), error: jest.fn() };

const createResponse = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const getHandler = (channelModule) => {
  const router = createChannelRoutes({
    verifyToken: (req, res, next) => next(),
    channelModule,
    archiveModule: {},
    channelDownloadAllModule: {},
    ratingMapper: require('../../modules/ratingMapper'),
    storageGuard: { isPausedError: jest.fn(() => false) },
  });
  const app = express();
  app.use(router);
  return findRouteHandler(app, 'get', PATH);
};

const request = () => ({ params: { channelId: 'UC123' }, log: loggerMock });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/channels/:channelId/tab-stats', () => {
  test('returns the channel tab stats', async () => {
    const stats = { channelId: 'UC123', tabs: { videos: { total: 10, percent: 50 } } };
    const handler = getHandler({ getChannelTabStats: jest.fn().mockResolvedValue(stats) });
    const res = createResponse();

    await handler(request(), res);

    expect(res.json).toHaveBeenCalledWith(stats);
  });

  test('returns 404 for an unknown channel', async () => {
    const handler = getHandler({ getChannelTabStats: jest.fn().mockResolvedValue(null) });
    const res = createResponse();

    await handler(request(), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 500 with an error message when the lookup throws', async () => {
    const handler = getHandler({ getChannelTabStats: jest.fn().mockRejectedValue(new Error('boom')) });
    const res = createResponse();

    await handler(request(), res);

    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to get channel tab stats' });
  });
});
