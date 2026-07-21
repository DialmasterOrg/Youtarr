const express = require('express');
const createVideoRoutes = require('../../routes/videos');
const { findRouteHandler } = require('../../__tests__/testUtils');

jest.mock('../../modules/jobModule', () => ({
  getRunningJobs: jest.fn().mockReturnValue([]),
}));
const jobModuleShared = require('../../modules/jobModule');

jest.mock('../../modules/videoDeletionModule', () => ({
  performAutomaticCleanup: jest.fn(),
}));
const videoDeletionModuleShared = require('../../modules/videoDeletionModule');

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
      error: expect.stringContaining('Invalid rating'),
    }));
  });
});

describe('POST /api/auto-removal/dry-run', () => {
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

  const getHandler = () => {
    const router = createVideoRoutes({
      verifyToken: (req, res, next) => next(),
      videosModule: {},
      downloadModule: {}
    });
    const app = express();
    app.use(router);
    return findRouteHandler(app, 'post', '/api/auto-removal/dry-run');
  };

  beforeEach(() => {
    jest.clearAllMocks();
    videoDeletionModuleShared.performAutomaticCleanup.mockResolvedValue({
      success: true,
      dryRun: true,
      errors: []
    });
  });

  test('forwards the watched and keep-recent overrides to the cleanup module', async () => {
    const handler = getHandler();
    const req = {
      body: {
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '30',
        autoRemovalWatchedEnabled: true,
        autoRemovalWatchedMinDaysSinceWatched: '7',
        autoRemovalWatchedMinVideoAgeDays: '14',
        autoRemovalKeepRecentCount: 5
      },
      log: loggerMock
    };
    const res = createResponse();

    await handler(req, res);

    expect(videoDeletionModuleShared.performAutomaticCleanup).toHaveBeenCalledWith({
      dryRun: true,
      overrides: {
        autoRemovalEnabled: true,
        autoRemovalVideoAgeThreshold: '30',
        autoRemovalWatchedEnabled: true,
        autoRemovalWatchedMinDaysSinceWatched: '7',
        autoRemovalWatchedMinVideoAgeDays: '14',
        autoRemovalKeepRecentCount: 5
      }
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
  });

  test('coerces a string autoRemovalWatchedEnabled to boolean', async () => {
    const handler = getHandler();
    const req = {
      body: { autoRemovalWatchedEnabled: 'true' },
      log: loggerMock
    };
    const res = createResponse();

    await handler(req, res);

    expect(videoDeletionModuleShared.performAutomaticCleanup).toHaveBeenCalledWith({
      dryRun: true,
      overrides: { autoRemovalWatchedEnabled: true }
    });
  });

  test('omits overrides that are not present in the request body', async () => {
    const handler = getHandler();
    const req = {
      body: { autoRemovalEnabled: true },
      log: loggerMock
    };
    const res = createResponse();

    await handler(req, res);

    expect(videoDeletionModuleShared.performAutomaticCleanup).toHaveBeenCalledWith({
      dryRun: true,
      overrides: { autoRemovalEnabled: true }
    });
  });
});

describe('POST /api/bulkEnrichVideos', () => {
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

  let enricherStub;

  const getHandler = () => {
    const router = createVideoRoutes({
      verifyToken: (req, res, next) => next(),
      videosModule: {},
      downloadModule: {},
      videoOembedEnricher: enricherStub,
    });
    const app = express();
    app.use(express.json());
    app.use(router);
    return findRouteHandler(app, 'post', '/api/bulkEnrichVideos');
  };

  beforeEach(() => {
    jest.clearAllMocks();
    enricherStub = { enrichByIds: jest.fn() };
  });

  test('returns enriched map from the oembed enricher', async () => {
    enricherStub.enrichByIds.mockResolvedValue({
      aaaaaaaaaaa: { title: 'A', channelName: 'CA' },
    });
    const handler = getHandler();
    const req = { body: { ids: ['aaaaaaaaaaa', 'bbbbbbbbbbb'] }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(enricherStub.enrichByIds).toHaveBeenCalledWith([
      'aaaaaaaaaaa',
      'bbbbbbbbbbb',
    ]);
    expect(res.json).toHaveBeenCalledWith({
      enriched: { aaaaaaaaaaa: { title: 'A', channelName: 'CA' } },
    });
  });

  test('returns 400 when ids is not an array', async () => {
    const handler = getHandler();
    const req = { body: { ids: 'not-an-array' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(enricherStub.enrichByIds).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'ids must be an array' });
  });

  test('returns 500 when the enricher throws', async () => {
    enricherStub.enrichByIds.mockRejectedValue(new Error('boom'));
    const handler = getHandler();
    const req = { body: { ids: ['aaaaaaaaaaa'] }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(loggerMock.error).toHaveBeenCalled();
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
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to update protection status' });
  });
});

describe('POST /triggerchanneldownloads', () => {
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

  let downloadModuleMock;

  beforeEach(() => {
    jest.clearAllMocks();
    jobModuleShared.getRunningJobs.mockReturnValue([]);

    downloadModuleMock = {
      doChannelAndPlaylistDownloads: jest.fn().mockResolvedValue(undefined),
    };
  });

  const getHandler = () => {
    const router = createVideoRoutes({
      verifyToken: (req, res, next) => next(),
      videosModule: {},
      downloadModule: downloadModuleMock,
    });
    const app = express();
    app.use(express.json());
    app.use(router);
    return findRouteHandler(app, 'post', '/triggerchanneldownloads');
  };

  it('triggers combined channel + playlist downloads', () => {
    const handler = getHandler();
    const req = {
      body: {},
      log: loggerMock,
    };
    const res = createResponse();

    handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ status: 'success' });
    expect(downloadModuleMock.doChannelAndPlaylistDownloads).toHaveBeenCalled();
  });

  it('returns 400 when a channel download job is already running', () => {
    jobModuleShared.getRunningJobs.mockReturnValue([
      { jobType: 'Channel Downloads', status: 'In Progress' },
    ]);

    const handler = getHandler();
    const req = {
      body: {},
      log: loggerMock,
    };
    const res = createResponse();

    handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Job Already Running' });
    expect(downloadModuleMock.doChannelAndPlaylistDownloads).not.toHaveBeenCalled();
  });
});
