const express = require('express');
const request = require('supertest');
const createExternalRequestReviewRoutes = require('../externalRequests');

const requestId = '9b89e5bc-8c90-4e72-b245-270fed2eacc2';

function makeApp({ authType = 'session', requestService, reviewLimiter } = {}) {
  const app = express();
  app.use(express.json());
  const verifyToken = (req, _res, next) => {
    req.authType = authType;
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
    reviewVideoRequest: jest.fn().mockResolvedValue({ id: requestId, status: 'processing' }),
  };
}

describe('external request administrator routes', () => {
  test('lists and reads across keys only for session-authenticated callers', async () => {
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

    await request(makeApp({ authType: 'api_key', requestService }))
      .get('/api/external-requests')
      .expect(403, { error: 'Session authentication is required' });
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
    expect(requestService.reviewVideoRequest).toHaveBeenNthCalledWith(
      1, requestId, 'approve', {}
    );
    expect(requestService.reviewVideoRequest).toHaveBeenNthCalledWith(
      2, requestId, 'reject', { reason: 'Not approved' }
    );
  });

  test('returns bounded service errors without exposing internal failures', async () => {
    const requestService = service();
    requestService.reviewVideoRequest.mockRejectedValueOnce(
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
