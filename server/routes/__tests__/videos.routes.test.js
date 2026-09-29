const express = require('express');
const createVideoRoutes = require('../../routes/videos');
const { findRouteHandler } = require('../../__tests__/testUtils');

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

  test('forwards the total usage limit override to the cleanup module', async () => {
    const handler = getHandler();
    const req = { body: { autoRemovalUsageLimit: '2TB' }, log: loggerMock };
    const res = createResponse();

    await handler(req, res);

    expect(videoDeletionModuleShared.performAutomaticCleanup).toHaveBeenCalledWith({
      dryRun: true,
      overrides: { autoRemovalUsageLimit: '2TB' }
    });
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

  let scheduledTaskManagerMock;

  beforeEach(() => {
    jest.clearAllMocks();

    scheduledTaskManagerMock = {
      runNow: jest.fn().mockResolvedValue({ started: true, completion: Promise.resolve(null) }),
    };
  });

  const getHandler = () => {
    const router = createVideoRoutes({
      verifyToken: (req, res, next) => next(),
      videosModule: {},
      downloadModule: {},
      scheduledTaskManager: scheduledTaskManagerMock,
    });
    const app = express();
    app.use(express.json());
    app.use(router);
    return findRouteHandler(app, 'post', '/triggerchanneldownloads');
  };

  it('responds with success when the sweep starts', async () => {
    const handler = getHandler();
    const res = createResponse();

    await handler({ body: {}, log: loggerMock }, res);

    expect(res.json).toHaveBeenCalledWith({ status: 'success' });
  });

  it('starts the automatic downloads task as a manual run outside the enabled and cooldown checks', async () => {
    const handler = getHandler();

    await handler({ body: {}, log: loggerMock }, createResponse());

    expect(scheduledTaskManagerMock.runNow).toHaveBeenCalledWith('channelDownloadFrequency', {
      trigger: 'manual',
      args: { jobData: {} },
      enforceEnabled: false,
      enforceCooldown: false,
    });
  });

  it('returns 409 when a channel and playlist update is already running', async () => {
    scheduledTaskManagerMock.runNow.mockResolvedValue({
      started: false, reason: 'running', message: 'This task is already running.', availableAt: null,
    });
    const handler = getHandler();
    const res = createResponse();

    await handler({ body: {}, log: loggerMock }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'A channel and playlist update is already running.',
      reason: 'running',
      availableAt: null,
    });
  });

  it('returns 409 with the reason when downloads are paused for storage', async () => {
    scheduledTaskManagerMock.runNow.mockResolvedValue({
      started: false, reason: 'downloads-paused', message: 'Downloads are paused: over the limit', availableAt: null,
    });
    const handler = getHandler();
    const res = createResponse();

    await handler({ body: {}, log: loggerMock }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Downloads are paused: over the limit',
      reason: 'downloads-paused',
      availableAt: null,
    });
  });

  it('returns 400 for an invalid override resolution', async () => {
    const handler = getHandler();
    const res = createResponse();

    await handler({ body: { overrideSettings: { resolution: '999' } }, log: loggerMock }, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('does not start the sweep for an invalid override resolution', async () => {
    const handler = getHandler();

    await handler({ body: { overrideSettings: { resolution: '999' } }, log: loggerMock }, createResponse());

    expect(scheduledTaskManagerMock.runNow).not.toHaveBeenCalled();
  });

  it('returns 500 when the sweep cannot be started', async () => {
    scheduledTaskManagerMock.runNow.mockRejectedValue(new Error('boom'));
    const handler = getHandler();
    const res = createResponse();

    await handler({ body: {}, log: loggerMock }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
