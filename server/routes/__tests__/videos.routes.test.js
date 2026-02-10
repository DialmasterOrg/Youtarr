const express = require('express');
const createVideoRoutes = require('../../routes/videos');
const { findRouteHandler } = require('../../__tests__/testUtils');

describe('POST /api/videos/rating', () => {
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

  const getHandler = (videosModuleMock) => {
    const router = createVideoRoutes({
      verifyToken: (req, res, next) => next(),
      videosModule: videosModuleMock,
      downloadModule: {}
    });

    const app = express();
    app.use(router);

    return findRouteHandler(app, 'post', '/api/videos/rating');
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('normalizes NR ratings to null before updating', async () => {
    const resultPayload = { success: [1], failed: [] };
    const videosModuleMock = {
      bulkUpdateVideoRatings: jest.fn().mockResolvedValue(resultPayload)
    };

    const handler = getHandler(videosModuleMock);
    const req = {
      body: { videoIds: [1], rating: ' nr ' },
      log: loggerMock
    };
    const res = createResponse();

    await handler(req, res);

    expect(videosModuleMock.bulkUpdateVideoRatings).toHaveBeenCalledWith([1], null);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(resultPayload);
  });

  test('rejects invalid normalized ratings', async () => {
    const videosModuleMock = {
      bulkUpdateVideoRatings: jest.fn().mockResolvedValue({ success: [], failed: [] })
    };

    const handler = getHandler(videosModuleMock);
    const req = {
      body: { videoIds: [42], rating: 'invalid' },
      log: loggerMock
    };
    const res = createResponse();

    await handler(req, res);

    expect(videosModuleMock.bulkUpdateVideoRatings).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'invalid rating value' });
  });
});
