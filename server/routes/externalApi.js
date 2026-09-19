const express = require('express');
const {
  sendExternalError,
  setExternalSecurityHeaders,
} = require('../modules/externalApiResponse');
const { scopesForExternalKey } = require('../modules/externalPermissions');

function createExternalApiRoutes({
  externalApiAuth,
  externalApiIngressLimiter = (_req, _res, next) => next(),
  externalApiLimiter,
  externalApiWriteLimiter = (_req, _res, next) => next(),
  recordExternalApiUse = (_req, _res, next) => next(),
  externalApiJsonParser = express.json({ limit: '16kb' }),
  serverVersion,
  catalogService,
  thumbnailProxy,
  externalWorkLimiter,
  requestService,
  quotaService,
}) {
  const router = express.Router();
  const requests = () => requestService;
  const quotas = () => quotaService;
  router.use((_req, res, next) => {
    setExternalSecurityHeaders(res);
    next();
  });
  router.use(externalApiIngressLimiter);
  router.use((req, res, next) => {
    if (!['GET', 'HEAD', 'POST'].includes(req.method)) {
      return sendExternalError(res, 405, 'HTTP method is not allowed', {
        code: 'method_not_allowed',
        requestId: req.id,
      });
    }
    return next();
  });
  router.use(externalApiAuth, externalApiLimiter, recordExternalApiUse);
  router.use((req, res, next) => {
    if (req.method !== 'POST') return next();
    const contentEncoding = String(req.get('content-encoding') || 'identity').toLowerCase();
    if (contentEncoding !== 'identity') {
      return sendExternalError(res, 415, 'Compressed request bodies are not supported', {
        code: 'unsupported_media_type',
        requestId: req.id,
      });
    }
    if (!req.is('application/json')) {
      return sendExternalError(res, 415, 'Content-Type must be application/json', {
        code: 'unsupported_media_type',
        requestId: req.id,
      });
    }
    return externalApiJsonParser(req, res, (error) => {
      if (!error) return next();
      if (error.type === 'entity.too.large') {
        return sendExternalError(res, 413, 'Request body is too large', {
          requestId: req.id,
        });
      }
      if (error instanceof SyntaxError || error.type === 'entity.parse.failed') {
        return sendExternalError(res, 400, 'Request body contains invalid JSON', {
          requestId: req.id,
        });
      }
      if (error.type === 'request.aborted') {
        return sendExternalError(res, 400, 'Request body was aborted', {
          requestId: req.id,
        });
      }
      return next(error);
    });
  });
  /**
   * @swagger
   * /external-api/v1/capabilities:
   *   get:
   *     summary: Read the calling key's effective external capabilities
   *     tags: [External API]
   *     security: [{ ExternalApiKeyAuth: [] }]
   *     responses:
   *       200: { description: Effective role, scopes, policy, and feature flags }
   *       401:
   *         description: Missing, invalid, legacy, revoked, or corrupt-policy key
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ExternalError' }
   */
  router.get('/capabilities', async (req, res) => {
    const key = req.externalApiKey;
    const scopes = scopesForExternalKey(key) || [];
    try {
      const quota = await quotas().status(key);
      return res.json({
        apiVersion: '1',
        serverVersion,
        role: key.role,
        scopes,
        policy: {
          allowVideoRequests: key.allowVideoRequests,
          allowChannelRequests: key.allowChannelRequests,
          allowDeleteVideoRequests: key.allowDeleteVideoRequests,
          autoApproveVideoRequests: key.autoApproveVideoRequests,
          autoApproveChannelRequests: key.autoApproveChannelRequests,
          autoApproveDeleteRequests: key.autoApproveDeleteRequests,
          maxRatingLevel: key.maxRatingLevel,
          allowUnrated: key.allowUnrated,
          allowedMediaTypes: key.allowedMediaTypes,
        },
        quota,
        features: {
          catalog: true, requests: true, channelRequests: true, deleteRequests: true,
          recommendations: true, authenticatedAssets: true, videoDetails: true,
        },
      });
    } catch (error) {
      req.log?.error({ err: error }, 'External API quota status failed');
      return sendExternalError(res, 500, 'External API capability lookup failed', {
        requestId: req.id,
      });
    }
  });

  const sendCatalogError = (req, res, error) => {
    if (error.name === 'ExternalWorkLimitError') {
      return sendExternalError(res, 503, 'External API work queue is full', {
        code: error.code,
        requestId: req.id,
      });
    }
    if (error.name === 'CatalogError' && error.status >= 400 && error.status < 500) {
      return sendExternalError(res, error.status, error.message, {
        code: error.code,
        requestId: req.id,
      });
    }
    req.log?.error({ err: error }, 'External catalog request failed');
    return sendExternalError(res, 500, 'External catalog request failed');
  };

  const sendRequestError = (req, res, error) => {
    if (['RequestError', 'QuotaError'].includes(error.name) &&
        error.status >= 400 && (error.status < 500 || error.status === 503)) {
      return sendExternalError(res, error.status, error.message, {
        code: error.code,
        requestId: req.id,
      });
    }
    req.log?.error({ err: error }, 'External request operation failed');
    return sendExternalError(res, 500, 'External request operation failed');
  };

  /**
   * @swagger
   * /external-api/v1/channels:
   *   get:
   *     summary: Browse cached channels granted to the calling key
   *     tags: [External API]
   *     security: [{ ExternalApiKeyAuth: [] }]
   *     parameters:
   *       - { in: query, name: cursor, description: Opaque cursor; mutually exclusive with page, schema: { type: string } }
   *       - { in: query, name: page, schema: { type: integer, minimum: 1, maximum: 100 } }
   *       - { in: query, name: pageSize, schema: { type: integer, minimum: 1, maximum: 100 } }
   *       - { in: query, name: search, schema: { type: string, maxLength: 200 } }
   *       - { in: query, name: subfolder, schema: { type: string, maxLength: 255 } }
   *       - { in: query, name: sortBy, schema: { type: string, enum: [title, videoCount, downloadedCount, id] } }
   *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc] } }
   *     responses:
   *       200: { description: Paginated cached channel catalog }
   *       401: { description: Missing or invalid external API key }
   */
  router.get('/channels', async (req, res) => {
    try {
      return res.json(await catalogService.listChannels(req.externalApiKey, req.query));
    } catch (error) {
      return sendCatalogError(req, res, error);
    }
  });

  /**
   * @swagger
   * /external-api/v1/channels/{id}/videos:
   *   get:
   *     summary: Browse eligible cached videos in one granted channel
   *     tags: [External API]
   *     security: [{ ExternalApiKeyAuth: [] }]
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: integer } }
   *       - { in: query, name: cursor, description: Opaque cursor; mutually exclusive with page, schema: { type: string } }
   *       - { in: query, name: page, schema: { type: integer, minimum: 1, maximum: 100 } }
   *       - { in: query, name: pageSize, schema: { type: integer, minimum: 1, maximum: 100 } }
   *       - { in: query, name: search, schema: { type: string, maxLength: 200 } }
   *       - { in: query, name: tabType, schema: { type: string, enum: [videos, shorts, streams] } }
   *       - { in: query, name: status, schema: { type: string, enum: [all, requestable, available, downloaded, requested] } }
   *       - { in: query, name: minDuration, schema: { type: integer, minimum: 0 } }
   *       - { in: query, name: maxDuration, schema: { type: integer, minimum: 0 } }
   *       - { in: query, name: dateFrom, schema: { type: string, format: date-time } }
   *       - { in: query, name: dateTo, schema: { type: string, format: date-time } }
   *       - { in: query, name: sortBy, schema: { type: string, enum: [date, title, duration] } }
   *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc] } }
   *     responses:
   *       200: { description: Paginated policy-filtered cached videos }
   *       404:
   *         description: Missing, disabled, terminated, or ungranted channel
   */
  router.get('/channels/:id/videos', async (req, res) => {
    try {
      return res.json(await catalogService.listChannelVideos(req.externalApiKey, req.params.id, req.query));
    } catch (error) {
      return sendCatalogError(req, res, error);
    }
  });

  /**
   * @swagger
   * /external-api/v1/videos:
   *   get:
   *     summary: Browse the complete cached video catalog across all granted channels
   *     description: Follow nextCursor to traverse every policy-filtered row without fetching channels individually. Use status=requestable to omit downloaded videos and active requests.
   *     tags: [External API]
   *     security: [{ ExternalApiKeyAuth: [] }]
   *     parameters:
   *       - { in: query, name: cursor, description: Opaque cursor; mutually exclusive with page, schema: { type: string } }
   *       - { in: query, name: page, description: Compatibility paging only; use cursor for complete traversal, schema: { type: integer, minimum: 1, maximum: 100 } }
   *       - { in: query, name: pageSize, schema: { type: integer, minimum: 1, maximum: 100 } }
   *       - { in: query, name: search, schema: { type: string, maxLength: 200 } }
   *       - { in: query, name: tabType, schema: { type: string, enum: [videos, shorts, streams] } }
   *       - { in: query, name: status, schema: { type: string, enum: [all, requestable, available, downloaded, requested] } }
   *       - { in: query, name: minDuration, schema: { type: integer, minimum: 0 } }
   *       - { in: query, name: maxDuration, schema: { type: integer, minimum: 0 } }
   *       - { in: query, name: dateFrom, schema: { type: string, format: date-time } }
   *       - { in: query, name: dateTo, schema: { type: string, format: date-time } }
   *       - { in: query, name: sortBy, schema: { type: string, enum: [date, title, duration] } }
   *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc] } }
   *     responses:
   *       200: { description: Complete cursor-paginated cached catalog; no Plex-derived signal enters Youtarr }
   */
  router.get('/videos', async (req, res) => {
    try {
      return res.json(await catalogService.listVideos(req.externalApiKey, req.query));
    } catch (error) {
      return sendCatalogError(req, res, error);
    }
  });

  /**
   * @swagger
   * /external-api/v1/videos/{youtubeId}:
   *   get:
   *     summary: Read full curated metadata for one eligible cached video
   *     description: Returns the catalog identity and status plus the metadata used by Youtarr's video detail modal.
   *     tags: [External API]
   *     security: [{ ExternalApiKeyAuth: [] }]
   *     parameters:
   *       - { in: path, name: youtubeId, required: true, schema: { type: string, minLength: 11, maxLength: 11 } }
   *     responses:
   *       200: { description: Full policy-filtered video detail }
   *       404: { description: Missing, hidden, ungranted, or ineligible video }
   */
  router.get('/videos/:youtubeId', async (req, res) => {
    try {
      return res.json(await externalWorkLimiter.run(() =>
        catalogService.getVideoDetail(req.externalApiKey, req.params.youtubeId)
      ));
    } catch (error) {
      return sendCatalogError(req, res, error);
    }
  });

  /**
   * @swagger
   * /external-api/v1/assets/channels/{id}/thumbnail:
   *   get:
   *     summary: Read eligible private channel artwork
   *     tags: [External API]
   *     security: [{ ExternalApiKeyAuth: [] }]
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: integer } }
   *     responses:
   *       200: { description: Private JPEG artwork }
   *       404: { description: Missing, unsafe, disabled, terminated, or ungranted asset }
   */
  router.get('/assets/channels/:id/thumbnail', async (req, res) => {
    try {
      const absolutePath = await catalogService.getChannelThumbnail(req.externalApiKey, req.params.id);
      res.set({
        'Content-Type': 'image/jpeg',
      });
      return res.sendFile(absolutePath);
    } catch (error) {
      return sendCatalogError(req, res, error);
    }
  });

  /**
   * @swagger
   * /external-api/v1/assets/videos/{youtubeId}/thumbnail:
   *   get:
   *     summary: Read eligible private video artwork
   *     tags: [External API]
   *     security: [{ ExternalApiKeyAuth: [] }]
   *     parameters:
   *       - { in: path, name: youtubeId, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: Private JPEG artwork }
   *       404: { description: Missing, unsafe, disabled, terminated, ungranted, or ineligible asset }
   */
  router.get('/assets/videos/:youtubeId/thumbnail', async (req, res) => {
    try {
      const asset = await catalogService.getVideoThumbnail(
        req.externalApiKey,
        req.params.youtubeId
      );
      if (typeof asset === 'string' || asset.source === 'local') {
        res.set({ 'Content-Type': 'image/jpeg' });
        return res.sendFile(typeof asset === 'string' ? asset : asset.absolutePath);
      }
      try {
        const proxied = await thumbnailProxy.fetchExternalThumbnail(asset.url);
        res.set({ 'Content-Type': proxied.contentType });
        return res.send(proxied.body);
      } catch (error) {
        req.log?.warn(
          { err: error, youtubeId: req.params.youtubeId },
          'External video thumbnail proxy failed'
        );
        return sendExternalError(res, 404, 'Thumbnail not found', {
          requestId: req.id,
        });
      }
    } catch (error) {
      return sendCatalogError(req, res, error);
    }
  });

  /**
   * @swagger
   * /external-api/v1/requests/videos:
   *   post:
   *     summary: Request a cached video from a granted channel
   *     tags: [External API]
   *     security: [{ ExternalApiKeyAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [youtubeId, channelId]
   *             properties:
   *               youtubeId: { type: string }
   *               channelId: { type: integer }
   *               idempotencyKey: { type: string, maxLength: 200 }
   *     responses:
   *       202: { description: Request persisted }
   *       403: { description: Required caller scope is missing }
   *       404: { description: Cached video is missing, hidden, or ineligible }
   *       409: { description: Idempotency key target conflict }
   */
  router.post('/requests/videos', externalApiWriteLimiter, async (req, res) => {
    try {
      const result = await requests().createVideoRequest(req.externalApiKey, req.body);
      return res.status(result.outcome === 'created' ? 202 : 200).json(result);
    } catch (error) {
      return sendRequestError(req, res, error);
    }
  });

  /**
   * @swagger
   * /external-api/v1/requests/channels:
   *   post:
   *     summary: Request canonical YouTube channel provisioning
   *     tags: [External API]
   *     security: [{ ExternalApiKeyAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [channelUrl]
   *             properties:
   *               channelUrl: { type: string, format: uri, maxLength: 500 }
   *               idempotencyKey: { type: string, maxLength: 200 }
   *     responses:
   *       202: { description: Approval-backed channel request created }
   *       200: { description: Existing idempotent request returned }
   */
  router.post('/requests/channels', externalApiWriteLimiter, async (req, res) => {
    try {
      const result = await requests().createChannelRequest(req.externalApiKey, req.body);
      return res.status(result.outcome === 'created' ? 202 : 200).json(result);
    } catch (error) {
      return sendRequestError(req, res, error);
    }
  });

  /**
   * @swagger
   * /external-api/v1/requests/delete-videos:
   *   post:
   *     summary: Request deletion of a downloaded video asset
   *     description: This never removes or disables the channel subscription.
   *     tags: [External API]
   *     security: [{ ExternalApiKeyAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [youtubeId, channelId]
   *             properties:
   *               youtubeId: { type: string, minLength: 11, maxLength: 11 }
   *               channelId: { type: integer, minimum: 1 }
   *               idempotencyKey: { type: string, maxLength: 200 }
   *     responses:
   *       202: { description: Approval-backed deletion request created }
   *       200: { description: Duplicate or already-deleted target }
   */
  router.post('/requests/delete-videos', externalApiWriteLimiter, async (req, res) => {
    try {
      const result = await requests().createDeleteVideoRequest(req.externalApiKey, req.body);
      return res.status(result.outcome === 'created' ? 202 : 200).json(result);
    } catch (error) {
      return sendRequestError(req, res, error);
    }
  });

  /**
   * @swagger
   * /external-api/v1/requests:
   *   get:
   *     summary: List requests created by the calling key
   *     tags: [External API]
   *     security: [{ ExternalApiKeyAuth: [] }]
   *     parameters:
   *       - in: query
   *         name: cursor
   *         description: Opaque cursor; mutually exclusive with page
   *         schema: { type: string }
   *       - in: query
   *         name: page
   *         schema: { type: integer, minimum: 1, maximum: 100, default: 1 }
   *       - in: query
   *         name: pageSize
   *         schema: { type: integer, minimum: 1, maximum: 100, default: 50 }
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending, approved, processing, completed, rejected, failed, cancelled]
   *     responses:
   *       200: { description: Paginated request status list }
   */
  router.get('/requests', async (req, res) => {
    try {
      return res.json(await requests().listRequests(req.externalApiKey, req.query));
    } catch (error) {
      return sendRequestError(req, res, error);
    }
  });

  /**
   * @swagger
   * /external-api/v1/requests/{id}:
   *   get:
   *     summary: Read one request created by the calling key
   *     tags: [External API]
   *     security: [{ ExternalApiKeyAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200: { description: Request status }
   *       404: { description: Request not found }
   */
  router.get('/requests/:id', async (req, res) => {
    try {
      return res.json(await requests().getRequest(req.externalApiKey, req.params.id));
    } catch (error) {
      return sendRequestError(req, res, error);
    }
  });

  // Keep every request that entered the external namespace inside its JSON
  // contract. Without this terminal handler, unknown GETs can fall through to
  // the SPA wildcard and unknown writes can receive Express's HTML 404.
  router.use((req, res) => sendExternalError(res, 404, 'External API route not found', {
    requestId: req.id,
  }));

  return router;
}

module.exports = { createExternalApiRoutes };
