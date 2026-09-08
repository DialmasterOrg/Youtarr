const express = require('express');

function createExternalRequestReviewRoutes({
  verifyToken,
  reviewLimiter = (_req, _res, next) => next(),
  requestService,
}) {
  const router = express.Router();
  const requests = () => requestService;

  const sessionOnly = (req, res, next) => {
    if (req.authType !== 'session') {
      return res.status(403).json({ error: 'Session authentication is required' });
    }
    return next();
  };

  const sendError = (req, res, error) => {
    if (error.name === 'RequestError' && error.status >= 400 && error.status < 500) {
      return res.status(error.status).json({ error: error.message });
    }
    req.log?.error({ err: error }, 'External request review operation failed');
    return res.status(500).json({ error: 'External request review operation failed' });
  };

  /**
   * @swagger
   * /api/external-requests:
   *   get:
   *     summary: List external requests for administrator review
   *     tags: [External Requests]
   *     security: [{ SessionAuth: [] }]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, minimum: 1, default: 1 }
   *       - in: query
   *         name: pageSize
   *         schema: { type: integer, minimum: 1, maximum: 100, default: 50 }
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending, approved, processing, completed, rejected, failed, cancelled]
   *       - in: query
   *         name: apiKeyId
   *         schema: { type: integer, minimum: 1 }
   *       - in: query
   *         name: requestType
   *         schema: { type: string, enum: [video, channel, delete_video] }
   *     responses:
   *       200: { description: Paginated requests and safe requester filter metadata }
   *       403: { description: Session authentication is required }
   */
  router.get('/api/external-requests', verifyToken, sessionOnly, async (req, res) => {
    try {
      return res.json(await requests().listAdminRequests(req.query));
    } catch (error) {
      return sendError(req, res, error);
    }
  });

  /**
   * @swagger
   * /api/external-requests/{id}:
   *   get:
   *     summary: Read one external request for administrator review
   *     tags: [External Requests]
   *     security: [{ SessionAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200: { description: Safe requester, target, and job metadata }
   *       403: { description: Session authentication is required }
   *       404: { description: Request not found }
   */
  router.get('/api/external-requests/:id', verifyToken, sessionOnly, async (req, res) => {
    try {
      return res.json(await requests().getAdminRequest(req.params.id));
    } catch (error) {
      return sendError(req, res, error);
    }
  });

  /**
   * @swagger
   * /api/external-requests/{id}/approve:
   *   post:
   *     summary: Revalidate and approve a pending external request
   *     tags: [External Requests]
   *     security: [{ SessionAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               grantToRequestingKey:
   *                 type: boolean
   *                 default: true
   *                 description: Channel requests only.
   *     responses:
   *       200: { description: Updated request }
   *       403: { description: Session authentication is required }
   *       404: { description: Request not found }
   *       409: { description: Request is not pending }
   *       429: { description: Review action rate limit exceeded }
   */
  router.post(
    '/api/external-requests/:id/approve',
    verifyToken,
    sessionOnly,
    reviewLimiter,
    async (req, res) => {
      try {
        const service = requests();
        const review = service.reviewRequest || service.reviewVideoRequest;
        return res.json(await review.call(service, req.params.id, 'approve', req.body));
      } catch (error) {
        return sendError(req, res, error);
      }
    }
  );

  /**
   * @swagger
   * /api/external-requests/{id}/reject:
   *   post:
   *     summary: Reject a pending external request
   *     tags: [External Requests]
   *     security: [{ SessionAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [reason]
   *             properties:
   *               reason: { type: string, minLength: 1, maxLength: 300 }
   *     responses:
   *       200: { description: Rejected request }
   *       400: { description: Invalid reason }
   *       403: { description: Session authentication is required }
   *       404: { description: Request not found }
   *       409: { description: Request is not pending }
   *       429: { description: Review action rate limit exceeded }
   */
  router.post(
    '/api/external-requests/:id/reject',
    verifyToken,
    sessionOnly,
    reviewLimiter,
    async (req, res) => {
      try {
        const service = requests();
        const review = service.reviewRequest || service.reviewVideoRequest;
        return res.json(await review.call(service, req.params.id, 'reject', req.body));
      } catch (error) {
        return sendError(req, res, error);
      }
    }
  );

  return router;
}

module.exports = createExternalRequestReviewRoutes;
