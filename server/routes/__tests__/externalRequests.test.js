const express = require('express');
const request = require('supertest');
const createExternalRequestReviewRoutes = require('../externalRequests');

const requestId = '9b89e5bc-8c90-4e72-b245-270fed2eacc2';

function makeApp({ authType = 'session', requestService, reviewLimiter } = {}) {
  const app = express();
  app.use(express.json());
  // authType null mimics AUTH_ENABLED=false, where verifyToken passes
  // requests through without identifying the caller.
  const verifyToken = (req, _res, next) => {
    if (authType) req.authType = authType;
    req.sessionId = authType === 'session' ? 'session-1' : undefined;
    next();
  };
  app.use(createExternalRequestReviewRoutes({
    verifyToken,
    requestService,
    reviewLimiter: reviewLimiter || ((_req, _res, next) => next()),
  }));
  return app;
}

function service() {
  return {
    listAdminRequests: jest.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
      filterOptions: { requesters: [] },
    }),
    getAdminRequest: jest.fn().mockResolvedValue({ id: requestId, status: 'pending' }),
    reviewRequest: jest.fn().mockResolvedValue({ id: requestId, status: 'processing' }),
  };
}

describe('external request administrator routes', () => {
  test('lists and reads across keys for session-authenticated callers', async () => {
    const requestService = service();
    const app = makeApp({ requestService });

    await request(app)
      .get('/api/external-requests?status=pending&apiKeyId=4&page=2')
      .expect(200);
    await request(app).get(`/api/external-requests/${requestId}`).expect(200);

    expect(requestService.listAdminRequests).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pending',
      apiKeyId: '4',
      page: '2',
    }));
    expect(requestService.getAdminRequest).toHaveBeenCalledWith(requestId);
  });

  test('rejects API-key callers', async () => {
    await request(makeApp({ authType: 'api_key', requestService: service() }))
      .get('/api/external-requests')
      .expect(403, { error: 'API keys cannot review external requests' });
  });

  test('allows review when authentication is disabled', async () => {
    const requestService = service();
    await request(makeApp({ authType: null, requestService }))
      .get('/api/external-requests')
      .expect(200);
  });

  test('rejects an x-api-key header even when authentication is disabled', async () => {
    await request(makeApp({ authType: null, requestService: service() }))
      .post(`/api/external-requests/${requestId}/approve`)
      .set('x-api-key', 'some-key')
      .send({})
      .expect(403, { error: 'API keys cannot review external requests' });
  });

  test('runs approve and reject through the dedicated action limiter', async () => {
    const requestService = service();
    const reviewLimiter = jest.fn((_req, _res, next) => next());
    const app = makeApp({ requestService, reviewLimiter });

    await request(app)
      .post(`/api/external-requests/${requestId}/approve`)
      .send({})
      .expect(200);
    await request(app)
      .post(`/api/external-requests/${requestId}/reject`)
      .send({ reason: 'Not approved' })
      .expect(200);

    expect(reviewLimiter).toHaveBeenCalledTimes(2);
    expect(requestService.reviewRequest).toHaveBeenNthCalledWith(
      1, requestId, 'approve', {}
    );
    expect(requestService.reviewRequest).toHaveBeenNthCalledWith(
      2, requestId, 'reject', { reason: 'Not approved' }
    );
  });

  test('returns bounded service errors without exposing internal failures', async () => {
    const requestService = service();
    requestService.reviewRequest.mockRejectedValueOnce(
      Object.assign(new Error('Only pending requests can be approved'), {
        name: 'RequestError',
        status: 409,
      })
    );
    await request(makeApp({ requestService }))
      .post(`/api/external-requests/${requestId}/approve`)
      .send({})
      .expect(409, { error: 'Only pending requests can be approved' });

    requestService.getAdminRequest.mockRejectedValueOnce(new Error('database password secret'));
    await request(makeApp({ requestService }))
      .get(`/api/external-requests/${requestId}`)
      .expect(500, { error: 'External request review operation failed' });
  });
});
