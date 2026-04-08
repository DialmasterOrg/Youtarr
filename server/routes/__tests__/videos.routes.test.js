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
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('Invalid rating value'),
    }));
  });
});

describe('PATCH /api/videos/:id/protected', () => {
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

    return findRouteHandler(app, 'patch', '/api/videos/:id/protected');
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('toggles protection on for a video', async () => {
    const videosModuleMock = {
      setVideoProtection: jest.fn().mockResolvedValue({ id: 1, protected: true })
    };

    const handler = getHandler(videosModuleMock);
    const req = {
      params: { id: '1' },
      body: { protected: true },
      log: loggerMock
    };
    const res = createResponse();

    await handler(req, res);

    expect(videosModuleMock.setVideoProtection).toHaveBeenCalledWith(1, true);
    expect(res.json).toHaveBeenCalledWith({ id: 1, protected: true });
  });

  test('toggles protection off for a video', async () => {
    const videosModuleMock = {
      setVideoProtection: jest.fn().mockResolvedValue({ id: 1, protected: false })
    };

    const handler = getHandler(videosModuleMock);
    const req = {
      params: { id: '1' },
      body: { protected: false },
      log: loggerMock
    };
    const res = createResponse();

    await handler(req, res);

    expect(videosModuleMock.setVideoProtection).toHaveBeenCalledWith(1, false);
    expect(res.json).toHaveBeenCalledWith({ id: 1, protected: false });
  });

  test('returns 400 when protected field is missing', async () => {
    const videosModuleMock = {
      setVideoProtection: jest.fn()
    };

    const handler = getHandler(videosModuleMock);
    const req = {
      params: { id: '1' },
      body: {},
      log: loggerMock
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'protected field (boolean) is required' });
    expect(videosModuleMock.setVideoProtection).not.toHaveBeenCalled();
  });

  test('returns 400 when protected is not a boolean', async () => {
    const videosModuleMock = {
      setVideoProtection: jest.fn()
    };

    const handler = getHandler(videosModuleMock);
    const req = {
      params: { id: '1' },
      body: { protected: 'yes' },
      log: loggerMock
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'protected field (boolean) is required' });
  });

  test('returns 404 when video not found', async () => {
    const videosModuleMock = {
      setVideoProtection: jest.fn().mockRejectedValue(new Error('Video not found'))
    };

    const handler = getHandler(videosModuleMock);
    const req = {
      params: { id: '999' },
      body: { protected: true },
      log: loggerMock
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Video not found' });
  });

  test('returns 500 on unexpected error', async () => {
    const videosModuleMock = {
      setVideoProtection: jest.fn().mockRejectedValue(new Error('Database connection lost'))
    };

    const handler = getHandler(videosModuleMock);
    const req = {
      params: { id: '1' },
      body: { protected: true },
      log: loggerMock
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Database connection lost' });
  });
});
