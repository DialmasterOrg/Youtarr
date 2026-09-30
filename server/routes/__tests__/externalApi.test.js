const express = require('express');
const request = require('supertest');
const { createExternalApiAuth } = require('../../middleware/externalApiAuth');
const { createExternalApiRoutes } = require('../externalApi');

function makeApp({
  enabled = true,
  key,
  catalogService,
  thumbnailProxy,
  externalWorkLimiter,
  requestService,
  writeLimiter,
  ingressLimiter,
} = {}) {
  const app = express();
  app.use((req, _res, next) => {
    req.id = 'request-123';
    next();
  });
  const validateApiKey = jest.fn().mockResolvedValue(key || null);
  if (enabled) {
    app.use('/external-api/v1', createExternalApiRoutes({
      externalApiAuth: createExternalApiAuth({ validateApiKey }),
      externalApiIngressLimiter: ingressLimiter || ((_req, _res, next) => next()),
      externalApiLimiter: (_req, _res, next) => next(),
      externalApiWriteLimiter: writeLimiter || ((_req, _res, next) => next()),
      serverVersion: '1.77.0',
      catalogService,
      thumbnailProxy,
      externalWorkLimiter: externalWorkLimiter || { run: (operation) => operation() },
      requestService,
      quotaService: {
        status: jest.fn().mockResolvedValue({
          limits: { maxActiveJobs: 5, hourlyWriteLimit: 30, dailyWriteLimit: 200 },
          remaining: { activeJobs: 5, hourlyWrites: 30, dailyWrites: 200 },
        }),
      },
    }));
  } else {
    app.use('/external-api', (_req, res) => res.status(404).json({
      error: { code: 'not_found', message: 'External API route not found' },
    }));
  }
  return { app, validateApiKey };
}

const externalKey = (overrides = {}) => ({
  id: 4, name: 'External Client', role: 'request', is_active: true, revoked_at: null,
  allow_video_requests: true, allow_channel_requests: true,
  allow_delete_video_requests: false,
  auto_approve_video_requests: true, auto_approve_channel_requests: false,
  auto_approve_delete_requests: false, max_rating_level: 3, allow_unrated: false,
  allowed_media_types: ['video'], max_active_jobs: 5, hourly_write_limit: 30,
  daily_write_limit: 200, ...overrides,
});

describe('external API capabilities', () => {
  test('returns 404 when feature flag is disabled', async () => {
    const { app } = makeApp({ enabled: false });
    await request(app).get('/external-api/v1/capabilities').expect(404, {
      error: { code: 'not_found', message: 'External API route not found' },
    });
  });

  test('requires x-api-key even when application auth is disabled', async () => {
    const old = process.env.AUTH_ENABLED;
    process.env.AUTH_ENABLED = 'false';
    const { app } = makeApp({ key: externalKey() });
    await request(app).get('/external-api/v1/capabilities').expect(401, {
      error: {
        code: 'missing_api_key',
        message: 'x-api-key is required',
        requestId: 'request-123',
      },
    });
    process.env.AUTH_ENABLED = old;
  });

  test.each([
    ['invalid', null],
    ['legacy', externalKey({ role: 'legacy_download' })],
    ['revoked', externalKey({ revoked_at: new Date() })],
  ])('rejects %s external keys', async (_name, key) => {
    const { app } = makeApp({ key });
    await request(app).get('/external-api/v1/capabilities').set('x-api-key', 'test-key').expect(401);
  });

  test.each([
    ['inactive', { is_active: false }],
    ['invalid rating', { max_rating_level: 9 }],
    ['invalid active-job quota', { max_active_jobs: 6 }],
    ['invalid hourly quota', { hourly_write_limit: 0 }],
    ['invalid daily quota', { daily_write_limit: '200' }],
    ['missing permission', { allow_video_requests: undefined }],
    ['missing media policy', { allowed_media_types: null }],
    ['inconsistent role', {
      role: 'view',
      allow_video_requests: false,
      allow_channel_requests: false,
      allow_delete_video_requests: true,
    }],
    ['invalid unrated flag', { allow_unrated: 'yes' }],
    ['invalid auto-approve flag', { auto_approve_video_requests: 1 }],
    ['auto-approve without permission', {
      allow_video_requests: false,
      allow_channel_requests: false,
      allow_delete_video_requests: false,
      auto_approve_video_requests: true,
    }],
  ])('fails closed for %s policy', async (_name, overrides) => {
    const { app } = makeApp({ key: externalKey(overrides) });
    await request(app)
      .get('/external-api/v1/capabilities')
      .set('x-api-key', 'test-key')
      .expect(401)
      .expect((response) => expect(response.body.error.code).toBe('invalid_key_policy'));
  });

  test('applies ingress limiting before database authentication', async () => {
    const ingressLimiter = jest.fn((_req, res) => res.status(429).json({ blocked: true }));
    const { app, validateApiKey } = makeApp({ key: externalKey(), ingressLimiter });
    await request(app).get('/external-api/v1/capabilities').expect(429);
    expect(validateApiKey).not.toHaveBeenCalled();
  });

  test('normalizes method, content type, malformed JSON, and body-size failures', async () => {
    const { app } = makeApp({ key: externalKey() });
    await request(app).put('/external-api/v1/capabilities').expect(405)
      .expect((response) => expect(response.body.error.code).toBe('method_not_allowed'));
    await request(app).post('/external-api/v1/requests/videos')
      .set('x-api-key', 'test-key')
      .set('Content-Type', 'text/plain')
      .send('not-json')
      .expect(415);
    await request(app).post('/external-api/v1/requests/videos')
      .set('x-api-key', 'test-key')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip')
      .send('{}')
      .expect(415);
    await request(app).post('/external-api/v1/requests/videos')
      .set('x-api-key', 'test-key')
      .set('Content-Type', 'application/json')
      .send('{"broken":')
      .expect(400);
    await request(app).post('/external-api/v1/requests/videos')
      .set('x-api-key', 'test-key')
      .send({ padding: 'x'.repeat(17 * 1024) })
      .expect(413);
  });

  test('keeps unknown v1 paths inside the external JSON contract', async () => {
    const { app } = makeApp({ key: externalKey() });
    const response = await request(app)
      .get('/external-api/v1/unknown')
      .set('x-api-key', 'test-key')
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: 'not_found',
        message: 'External API route not found',
        requestId: 'request-123',
      },
    });
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.headers['cache-control']).toBe('private, no-store');
  });

  test('marks authentication errors private and non-cacheable', async () => {
    const { app } = makeApp({ key: externalKey() });
    const response = await request(app).get('/external-api/v1/capabilities').expect(401);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers.vary).toContain('x-api-key');
  });

  test('returns role scopes and sanitized policy', async () => {
    const { app } = makeApp({ key: externalKey() });
    const response = await request(app).get('/external-api/v1/capabilities').set('x-api-key', 'test-key').expect(200);
    expect(response.body).toEqual({
      apiVersion: '1', serverVersion: '1.77.0', role: 'request',
      scopes: ['catalog:read', 'requests:read', 'video:request', 'channel:request'],
      policy: {
        allowVideoRequests: true,
        allowChannelRequests: true,
        allowDeleteVideoRequests: false,
        autoApproveVideoRequests: true, autoApproveChannelRequests: false,
        autoApproveDeleteRequests: false, maxRatingLevel: 3, allowUnrated: false,
        allowedMediaTypes: ['video'],
      },
      quota: {
        limits: { maxActiveJobs: 5, hourlyWriteLimit: 30, dailyWriteLimit: 200 },
        remaining: { activeJobs: 5, hourlyWrites: 30, dailyWrites: 200 },
      },
      features: {
        catalog: true, requests: true, channelRequests: true, deleteRequests: true,
        recommendations: true, authenticatedAssets: true, videoDetails: true,
      },
    });
  });

  test('reports independently configured request scopes', async () => {
    const { app } = makeApp({
      key: externalKey({
        allow_video_requests: true,
        allow_channel_requests: false,
        allow_delete_video_requests: false,
      }),
    });
    await request(app).get('/external-api/v1/capabilities')
      .set('x-api-key', 'test-key')
      .expect(200)
      .expect((response) => {
        expect(response.body.scopes).toEqual([
          'catalog:read',
          'requests:read',
          'video:request',
        ]);
        expect(response.body.policy).toEqual(expect.objectContaining({
          allowVideoRequests: true,
          allowChannelRequests: false,
          allowDeleteVideoRequests: false,
        }));
      });
  });

  test('persists video requests behind the lower write limiter', async () => {
    const requestService = {
      createVideoRequest: jest.fn().mockResolvedValue({
        outcome: 'created',
        request: {
          id: '9b89e5bc-8c90-4e72-b245-270fed2eacc2',
          type: 'video',
          status: 'pending',
          target: { youtubeId: 'abcdefghijk', channelId: 8 },
          createdAt: '2026-07-26T12:00:00.000Z',
          updatedAt: '2026-07-26T12:00:00.000Z',
        },
      }),
      listRequests: jest.fn(),
      getRequest: jest.fn(),
    };
    const writeLimiter = jest.fn((_req, _res, next) => next());
    const { app } = makeApp({ key: externalKey(), requestService, writeLimiter });
    await request(app).post('/external-api/v1/requests/videos')
      .set('x-api-key', 'test-key')
      .send({ youtubeId: 'abcdefghijk', channelId: 8 })
      .expect(202)
      .expect((response) => expect(response.body.outcome).toBe('created'));
    expect(writeLimiter).toHaveBeenCalled();
    expect(requestService.createVideoRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4, role: 'request' }),
      { youtubeId: 'abcdefghijk', channelId: 8 }
    );
  });

  test('routes candidate, channel, and delete operations through constrained services', async () => {
    const catalogService = {
      listVideos: jest.fn().mockResolvedValue({
        data: [],
        pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
        dataSource: 'cache',
        isFullyIndexed: true,
      }),
    };
    const requestService = {
      createChannelRequest: jest.fn().mockResolvedValue({
        outcome: 'created',
        request: { type: 'channel', status: 'pending' },
      }),
      createDeleteVideoRequest: jest.fn().mockResolvedValue({
        outcome: 'already_deleted',
        request: null,
      }),
    };
    const writeLimiter = jest.fn((_req, _res, next) => next());
    const { app } = makeApp({
      key: externalKey({ role: 'delete', allow_delete_video_requests: true }),
      catalogService,
      requestService,
      writeLimiter,
    });

    await request(app).get('/external-api/v1/videos?page=1&pageSize=100')
      .set('x-api-key', 'test-key').expect(200);
    await request(app).post('/external-api/v1/requests/channels')
      .set('x-api-key', 'test-key')
      .send({ channelUrl: 'https://www.youtube.com/@safe' })
      .expect(202);
    await request(app).post('/external-api/v1/requests/delete-videos')
      .set('x-api-key', 'test-key')
      .send({ youtubeId: 'abcdefghijk', channelId: 8 })
      .expect(200, { outcome: 'already_deleted', request: null });

    expect(catalogService.listVideos).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4, role: 'delete' }),
      expect.objectContaining({ page: '1', pageSize: '100' })
    );
    expect(requestService.createChannelRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4 }),
      { channelUrl: 'https://www.youtube.com/@safe' }
    );
    expect(requestService.createDeleteVideoRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4 }),
      { youtubeId: 'abcdefghijk', channelId: 8 }
    );
    expect(writeLimiter).toHaveBeenCalledTimes(2);
  });

  test('lists and reads only through the authenticated request service', async () => {
    const requestService = {
      createVideoRequest: jest.fn(),
      listRequests: jest.fn().mockResolvedValue({
        data: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
      }),
      getRequest: jest.fn().mockResolvedValue({
        id: '9b89e5bc-8c90-4e72-b245-270fed2eacc2',
        type: 'video',
        status: 'pending',
        target: { youtubeId: 'abcdefghijk', channelId: 8 },
        createdAt: '2026-07-26T12:00:00.000Z',
        updatedAt: '2026-07-26T12:00:00.000Z',
      }),
    };
    const { app } = makeApp({ key: externalKey(), requestService });
    await request(app).get('/external-api/v1/requests?status=pending')
      .set('x-api-key', 'test-key').expect(200);
    await request(app)
      .get('/external-api/v1/requests/9b89e5bc-8c90-4e72-b245-270fed2eacc2')
      .set('x-api-key', 'test-key').expect(200);
    expect(requestService.listRequests).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4 }),
      expect.objectContaining({ status: 'pending' })
    );
    expect(requestService.getRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4 }),
      '9b89e5bc-8c90-4e72-b245-270fed2eacc2'
    );
  });

  test('normalizes duplicate media types and fails closed on unknown media policies', async () => {
    const normalized = makeApp({ key: externalKey({ allowed_media_types: ['video', 'video'] }) });
    await request(normalized.app).get('/external-api/v1/capabilities').set('x-api-key', 'test-key')
      .expect(200).expect((response) => expect(response.body.policy.allowedMediaTypes).toEqual(['video']));

    const corrupt = makeApp({ key: externalKey({ allowed_media_types: ['video', 'unknown'] }) });
    await request(corrupt.app).get('/external-api/v1/capabilities').set('x-api-key', 'test-key').expect(401);
  });

  test('protects catalog routes and forwards only authenticated key policy', async () => {
    const catalogService = {
      listChannels: jest.fn().mockResolvedValue({
        data: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 }, dataSource: 'cache',
      }),
      listChannelVideos: jest.fn(),
      getChannelThumbnail: jest.fn(),
    };
    const { app } = makeApp({ key: externalKey(), catalogService });
    await request(app).get('/external-api/v1/channels').expect(401);
    await request(app).get('/external-api/v1/channels?page=1').set('x-api-key', 'test-key').expect(200);
    expect(catalogService.listChannels).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4, maxRatingLevel: 3, allowedMediaTypes: ['video'] }),
      expect.objectContaining({ page: '1' })
    );
  });

  test('returns one authenticated policy-filtered video detail', async () => {
    const detail = {
      youtubeId: 'abcdefghijk',
      title: 'Detailed video',
      thumbnailUrl: '/external-api/v1/assets/videos/abcdefghijk/thumbnail',
      metadata: { description: 'Full description', viewCount: 1000 },
    };
    const catalogService = {
      getVideoDetail: jest.fn().mockResolvedValue(detail),
    };
    const { app } = makeApp({ key: externalKey(), catalogService });

    await request(app)
      .get('/external-api/v1/videos/abcdefghijk')
      .set('x-api-key', 'test-key')
      .expect(200, detail);
    expect(catalogService.getVideoDetail).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4, maxRatingLevel: 3 }),
      'abcdefghijk'
    );
  });

  test('keeps missing and ineligible video details indistinguishable', async () => {
    const notFound = Object.assign(new Error('Video not found'), {
      name: 'CatalogError',
      status: 404,
    });
    const catalogService = {
      getVideoDetail: jest.fn().mockRejectedValue(notFound),
    };
    const { app } = makeApp({ key: externalKey(), catalogService });

    await request(app)
      .get('/external-api/v1/videos/abcdefghijk')
      .set('x-api-key', 'test-key')
      .expect(404)
      .expect((response) => expect(response.body.error.message).toBe('Video not found'));
  });

  test('bounds expensive video-detail metadata work', async () => {
    const workError = Object.assign(new Error('full'), {
      name: 'ExternalWorkLimitError',
      code: 'work_queue_full',
    });
    const externalWorkLimiter = {
      run: jest.fn().mockRejectedValue(workError),
    };
    const catalogService = { getVideoDetail: jest.fn() };
    const { app } = makeApp({
      key: externalKey(),
      catalogService,
      externalWorkLimiter,
    });

    await request(app)
      .get('/external-api/v1/videos/abcdefghijk')
      .set('x-api-key', 'test-key')
      .expect(503)
      .expect((response) => expect(response.body.error.code).toBe('work_queue_full'));
    expect(catalogService.getVideoDetail).not.toHaveBeenCalled();
  });

  test('does not reveal whether an ungranted channel exists', async () => {
    const notFound = Object.assign(new Error('Channel not found'), { name: 'CatalogError', status: 404 });
    const catalogService = {
      listChannels: jest.fn(),
      listChannelVideos: jest.fn().mockRejectedValue(notFound),
      getChannelThumbnail: jest.fn().mockRejectedValue(
        Object.assign(new Error('Thumbnail not found'), { name: 'CatalogError', status: 404 })
      ),
    };
    const { app } = makeApp({ key: externalKey(), catalogService });
    await request(app).get('/external-api/v1/channels/99/videos').set('x-api-key', 'test-key')
      .expect(404, {
        error: {
          code: 'not_found',
          message: 'Channel not found',
          requestId: 'request-123',
        },
      });
    await request(app).get('/external-api/v1/assets/channels/99/thumbnail').set('x-api-key', 'test-key')
      .expect(404, {
        error: {
          code: 'not_found',
          message: 'Thumbnail not found',
          requestId: 'request-123',
        },
      });
  });

  test('serves granted channel artwork with private cache and nosniff headers', async () => {
    const catalogService = {
      listChannels: jest.fn(),
      listChannelVideos: jest.fn(),
      getChannelThumbnail: jest.fn().mockResolvedValue(__filename),
    };
    const { app } = makeApp({ key: externalKey(), catalogService });
    const response = await request(app)
      .get('/external-api/v1/assets/channels/8/thumbnail')
      .set('x-api-key', 'test-key')
      .expect(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers.vary).toContain('x-api-key');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-type']).toMatch(/^image\/jpeg/);
  });

  test('serves optimized local video artwork through the authenticated API route', async () => {
    const catalogService = {
      getVideoThumbnail: jest.fn().mockResolvedValue({
        source: 'local',
        absolutePath: __filename,
      }),
    };
    const { app } = makeApp({ key: externalKey(), catalogService });

    const response = await request(app)
      .get('/external-api/v1/assets/videos/abcdefghijk/thumbnail')
      .set('x-api-key', 'test-key')
      .expect(200);
    expect(response.headers['content-type']).toMatch(/^image\/jpeg/);
    expect(catalogService.getVideoThumbnail).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4 }),
      'abcdefghijk'
    );
  });

  test('proxies approved upstream artwork through Youtarr when no local thumbnail exists', async () => {
    const catalogService = {
      getVideoThumbnail: jest.fn().mockResolvedValue({
        source: 'upstream',
        url: 'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg',
      }),
    };
    const thumbnailProxy = {
      fetchExternalThumbnail: jest.fn().mockResolvedValue({
        body: Buffer.from('proxied-image'),
        contentType: 'image/jpeg',
      }),
    };
    const { app } = makeApp({ key: externalKey(), catalogService, thumbnailProxy });

    const response = await request(app)
      .get('/external-api/v1/assets/videos/abcdefghijk/thumbnail')
      .set('x-api-key', 'test-key')
      .expect(200);
    expect(response.body).toEqual(Buffer.from('proxied-image'));
    expect(thumbnailProxy.fetchExternalThumbnail).toHaveBeenCalledWith(
      'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg'
    );
  });

  test('returns the private error contract when upstream artwork cannot be fetched', async () => {
    const catalogService = {
      getVideoThumbnail: jest.fn().mockResolvedValue({
        source: 'upstream',
        url: 'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg',
      }),
    };
    const thumbnailProxy = {
      fetchExternalThumbnail: jest.fn().mockRejectedValue(new Error('offline')),
    };
    const { app } = makeApp({ key: externalKey(), catalogService, thumbnailProxy });

    const response = await request(app)
      .get('/external-api/v1/assets/videos/abcdefghijk/thumbnail')
      .set('x-api-key', 'test-key')
      .expect(404);
    expect(response.body.error).toMatchObject({
      code: 'not_found',
      message: 'Thumbnail not found',
      requestId: 'request-123',
    });
    expect(response.headers['cache-control']).toBe('private, no-store');
  });
});
