/* eslint-env jest */

// channels.js requires these directly at factory top; mock them so requiring
// the route file does not pull in the real database or logger transport.
jest.mock('../../modules/channelSettingsModule', () => ({
  validateSubFolder: jest.fn().mockReturnValue({ valid: true }),
}));
jest.mock('../../models/channelvideo', () => ({}));
jest.mock('../../logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const express = require('express');
const createChannelRoutes = require('../channels');
const { findRouteHandler } = require('../../__tests__/testUtils');

const ADD_PATH = '/addchannelinfo';

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
  channelModule: {
    getChannelInfo: jest.fn(),
  },
  archiveModule: {},
  channelDownloadAllModule: {},
  ratingMapper: require('../../modules/ratingMapper'),
});

const getHandler = (deps) => {
  const router = createChannelRoutes(deps);
  const app = express();
  app.use(express.json());
  app.use(router);
  return findRouteHandler(app, 'post', ADD_PATH);
};

const rejectWithCode = (code) => {
  const error = new Error(code);
  error.code = code;
  return Promise.reject(error);
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /addchannelinfo error mapping', () => {
  test('returns 422 pointing at playlist subscriptions for a releases-only channel', async () => {
    const deps = buildDeps();
    deps.channelModule.getChannelInfo.mockImplementation(() =>
      rejectWithCode('CHANNEL_RELEASES_ONLY')
    );

    const handler = getHandler(deps);
    const req = { body: { url: 'https://www.youtube.com/@artistchan' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        message: expect.stringContaining('Playlists page'),
      })
    );
  });

  test('returns 422 with the no-videos message for an empty channel', async () => {
    const deps = buildDeps();
    deps.channelModule.getChannelInfo.mockImplementation(() =>
      rejectWithCode('CHANNEL_EMPTY')
    );

    const handler = getHandler(deps);
    const req = { body: { url: 'https://www.youtube.com/@emptychan' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        message: 'This channel has no videos to download.',
      })
    );
  });
});
