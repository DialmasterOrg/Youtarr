/* eslint-env jest */
const express = require('express');
const createVideoDetailRoutes = require('../videoDetail');
const { findRouteHandler, findRouteHandlers } = require('../../__tests__/testUtils');

// Mock fs (synchronous methods used by stream endpoint)
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    accessSync: jest.fn(),
    statSync: jest.fn(),
    createReadStream: jest.fn(),
    constants: actual.constants,
  };
});

const fs = require('fs');

describe('GET /api/videos/:youtubeId/metadata', () => {
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

  const getHandler = (videoMetadataModuleMock) => {
    const router = createVideoDetailRoutes({
      verifyToken: (req, res, next) => next(),
      videoMetadataModule: videoMetadataModuleMock,
    });

    const app = express();
    app.use(router);

    return findRouteHandler(app, 'get', '/api/videos/:youtubeId/metadata');
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns metadata from videoMetadataModule', async () => {
    const mockMetadata = {
      description: 'Test video',
      viewCount: 1000,
      likeCount: 50,
      resolution: '1080p',
    };

    const videoMetadataModuleMock = {
      getVideoMetadata: jest.fn().mockResolvedValue(mockMetadata),
    };

    const handler = getHandler(videoMetadataModuleMock);
    const req = {
      params: { youtubeId: 'abc123' },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(videoMetadataModuleMock.getVideoMetadata).toHaveBeenCalledWith('abc123');
    expect(res.json).toHaveBeenCalledWith(mockMetadata);
  });

  test('returns 400 for missing youtubeId', async () => {
    const videoMetadataModuleMock = {
      getVideoMetadata: jest.fn(),
    };

    const handler = getHandler(videoMetadataModuleMock);
    const req = {
      params: { youtubeId: '' },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid YouTube ID' });
    expect(videoMetadataModuleMock.getVideoMetadata).not.toHaveBeenCalled();
  });

  test('returns 400 for overly long youtubeId', async () => {
    const videoMetadataModuleMock = {
      getVideoMetadata: jest.fn(),
    };

    const handler = getHandler(videoMetadataModuleMock);
    const req = {
      params: { youtubeId: 'a'.repeat(21) },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid YouTube ID' });
  });

  test('returns 400 for youtubeId with path traversal characters', async () => {
    const videoMetadataModuleMock = {
      getVideoMetadata: jest.fn(),
    };

    const handler = getHandler(videoMetadataModuleMock);
    const req = {
      params: { youtubeId: '../../etc/passwd' },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid YouTube ID' });
    expect(videoMetadataModuleMock.getVideoMetadata).not.toHaveBeenCalled();
  });

  test('returns 500 when module throws', async () => {
    const videoMetadataModuleMock = {
      getVideoMetadata: jest.fn().mockRejectedValue(new Error('boom')),
    };

    const handler = getHandler(videoMetadataModuleMock);
    const req = {
      params: { youtubeId: 'abc123' },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to retrieve video metadata' });
  });
});

describe('GET /api/videos/:youtubeId/stream', () => {
  const loggerMock = {
    info: jest.fn(),
    error: jest.fn(),
  };

  const createResponse = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    res.set = jest.fn(() => res);
    res.end = jest.fn(() => res);
    res.destroy = jest.fn();
    return res;
  };

  const getHandler = (videoMetadataModuleMock) => {
    const router = createVideoDetailRoutes({
      verifyToken: (req, res, next) => next(),
      videoMetadataModule: videoMetadataModuleMock || {
        getVideoStreamInfo: jest.fn().mockResolvedValue({ error: 'not_found', message: 'Video not found' }),
      },
    });

    const app = express();
    app.use(router);

    return findRouteHandler(app, 'get', '/api/videos/:youtubeId/stream');
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 400 for invalid youtubeId', async () => {
    const handler = getHandler();
    const req = {
      params: { youtubeId: '' },
      query: {},
      headers: {},
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid YouTube ID' });
  });

  test('returns 400 for invalid type parameter', async () => {
    const handler = getHandler();
    const req = {
      params: { youtubeId: 'abc123' },
      query: { type: 'invalid' },
      headers: {},
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid type parameter. Must be "video" or "audio"',
    });
  });

  test('returns 404 when video record not found', async () => {
    const videoMetadataModuleMock = {
      getVideoStreamInfo: jest.fn().mockResolvedValue({ error: 'not_found', message: 'Video not found' }),
    };

    const handler = getHandler(videoMetadataModuleMock);
    const req = {
      params: { youtubeId: 'notfound1' },
      query: {},
      headers: {},
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Video not found' });
  });

  test('returns 404 when video has no filePath', async () => {
    const videoMetadataModuleMock = {
      getVideoStreamInfo: jest.fn().mockResolvedValue({ error: 'no_file', message: 'No video file available for this video' }),
    };

    const handler = getHandler(videoMetadataModuleMock);
    const req = {
      params: { youtubeId: 'nofile1' },
      query: {},
      headers: {},
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'No video file available for this video' });
  });

  test('returns 404 when audio requested but no audioFilePath', async () => {
    const videoMetadataModuleMock = {
      getVideoStreamInfo: jest.fn().mockResolvedValue({ error: 'no_file', message: 'No audio file available for this video' }),
    };

    const handler = getHandler(videoMetadataModuleMock);
    const req = {
      params: { youtubeId: 'noaudio1' },
      query: { type: 'audio' },
      headers: {},
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'No audio file available for this video' });
  });

  test('returns 404 when file does not exist on disk', async () => {
    const videoMetadataModuleMock = {
      getVideoStreamInfo: jest.fn().mockResolvedValue({ error: 'file_missing', message: 'File not found on disk' }),
    };

    const handler = getHandler(videoMetadataModuleMock);
    const req = {
      params: { youtubeId: 'diskfail1' },
      query: {},
      headers: {},
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'File not found on disk' });
  });

  test('streams full file without Range header and includes Cache-Control headers', async () => {
    const videoMetadataModuleMock = {
      getVideoStreamInfo: jest.fn().mockResolvedValue({
        filePath: '/data/channel/video [abc123].mp4',
        contentType: 'video/mp4',
        fileSize: 5000,
      }),
    };

    const mockStream = { on: jest.fn().mockReturnThis(), pipe: jest.fn() };
    fs.createReadStream.mockReturnValue(mockStream);

    const handler = getHandler(videoMetadataModuleMock);
    const req = {
      params: { youtubeId: 'abc123' },
      query: {},
      headers: {},
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.set).toHaveBeenCalledWith({
      'Content-Length': 5000,
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache',
    });
    expect(fs.createReadStream).toHaveBeenCalledWith('/data/channel/video [abc123].mp4');
    expect(mockStream.pipe).toHaveBeenCalledWith(res);
  });

  test('streams partial content with Range header and includes Cache-Control headers', async () => {
    const videoMetadataModuleMock = {
      getVideoStreamInfo: jest.fn().mockResolvedValue({
        filePath: '/data/channel/video [range1].mp4',
        contentType: 'video/mp4',
        fileSize: 10000,
      }),
    };

    const mockStream = { on: jest.fn().mockReturnThis(), pipe: jest.fn() };
    fs.createReadStream.mockReturnValue(mockStream);

    const handler = getHandler(videoMetadataModuleMock);
    const req = {
      params: { youtubeId: 'range1' },
      query: {},
      headers: { range: 'bytes=0-999' },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(206);
    expect(res.set).toHaveBeenCalledWith({
      'Content-Range': 'bytes 0-999/10000',
      'Accept-Ranges': 'bytes',
      'Content-Length': 1000,
      'Content-Type': 'video/mp4',
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache',
    });
    expect(fs.createReadStream).toHaveBeenCalledWith(
      '/data/channel/video [range1].mp4',
      { start: 0, end: 999 }
    );
  });

  test('returns 416 for out-of-range request', async () => {
    const videoMetadataModuleMock = {
      getVideoStreamInfo: jest.fn().mockResolvedValue({
        filePath: '/data/channel/video [outofrange1].mp4',
        contentType: 'video/mp4',
        fileSize: 5000,
      }),
    };

    const handler = getHandler(videoMetadataModuleMock);
    const req = {
      params: { youtubeId: 'outofrange1' },
      query: {},
      headers: { range: 'bytes=6000-7000' },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(416);
    expect(res.set).toHaveBeenCalledWith('Content-Range', 'bytes */5000');
  });

  test('returns 416 for malformed Range header with non-numeric values', async () => {
    const videoMetadataModuleMock = {
      getVideoStreamInfo: jest.fn().mockResolvedValue({
        filePath: '/data/channel/video [malrange].mp4',
        contentType: 'video/mp4',
        fileSize: 5000,
      }),
    };

    const handler = getHandler(videoMetadataModuleMock);
    const req = {
      params: { youtubeId: 'malrange1234' },
      query: {},
      headers: { range: 'bytes=abc-def' },
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(416);
    expect(res.set).toHaveBeenCalledWith('Content-Range', 'bytes */5000');
    expect(fs.createReadStream).not.toHaveBeenCalled();
  });

  test('streams audio file when type=audio', async () => {
    const videoMetadataModuleMock = {
      getVideoStreamInfo: jest.fn().mockResolvedValue({
        filePath: '/data/channel/video [audio1].mp3',
        contentType: 'audio/mpeg',
        fileSize: 3000,
      }),
    };

    const mockStream = { on: jest.fn().mockReturnThis(), pipe: jest.fn() };
    fs.createReadStream.mockReturnValue(mockStream);

    const handler = getHandler(videoMetadataModuleMock);
    const req = {
      params: { youtubeId: 'audio1' },
      query: { type: 'audio' },
      headers: {},
      log: loggerMock,
    };
    const res = createResponse();

    await handler(req, res);

    expect(videoMetadataModuleMock.getVideoStreamInfo).toHaveBeenCalledWith('audio1', 'audio');
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'audio/mpeg',
      })
    );
    expect(fs.createReadStream).toHaveBeenCalledWith('/data/channel/video [audio1].mp3');
  });

  test('queryTokenToHeader copies query token to header', () => {
    const router = createVideoDetailRoutes({
      verifyToken: (req, res, next) => next(),
      videoMetadataModule: {},
    });

    const app = express();
    app.use(router);

    // Find all handlers for the stream endpoint (includes queryTokenToHeader middleware)
    const handlers = findRouteHandlers(app, 'get', '/api/videos/:youtubeId/stream');

    // The first handler in the chain should be queryTokenToHeader
    const queryTokenMiddleware = handlers[0];

    const req = {
      query: { token: 'my-secret-token' },
      headers: {},
    };

    const next = jest.fn();
    queryTokenMiddleware(req, {}, next);

    expect(req.headers['x-access-token']).toBe('my-secret-token');
    expect(next).toHaveBeenCalled();
  });

  test('queryTokenToHeader does not override existing header', () => {
    const router = createVideoDetailRoutes({
      verifyToken: (req, res, next) => next(),
      videoMetadataModule: {},
    });

    const app = express();
    app.use(router);

    const handlers = findRouteHandlers(app, 'get', '/api/videos/:youtubeId/stream');
    const queryTokenMiddleware = handlers[0];

    const req = {
      query: { token: 'query-token' },
      headers: { 'x-access-token': 'header-token' },
    };

    const next = jest.fn();
    queryTokenMiddleware(req, {}, next);

    // Should keep the existing header, not override it
    expect(req.headers['x-access-token']).toBe('header-token');
    expect(next).toHaveBeenCalled();
  });
});
