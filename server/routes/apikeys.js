const express = require('express');

/**
 * Creates API key management routes
 * @param {Object} deps - Dependencies
 * @param {Function} deps.verifyToken - Token verification middleware
 * @returns {express.Router}
 */
module.exports = function createApiKeyRoutes({ verifyToken }) {
  const router = express.Router();
  const apiKeyModule = require('../modules/apiKeyModule');
  const apiKeyChannelGrantModule = require('../modules/apiKeyChannelGrantModule');
  const { sequelize } = require('../db');

  const isPolicyValidationError = (error) =>
    error.message.includes('Invalid') ||
    error.message.includes('Policy') ||
    error.message.includes('Unsupported') ||
    error.message.includes('allowedMediaTypes') ||
    error.message.includes('maxRatingLevel') ||
    error.message.includes('maxActiveJobs') ||
    error.message.includes('hourlyWriteLimit') ||
    error.message.includes('dailyWriteLimit') ||
    error.message.includes('requires allow') ||
    error.message.includes('external API key types') ||
    error.message.includes('channelIds') ||
    error.message.includes('enabled channel') ||
    error.message.includes('Only active external API keys');

  // AUTH_ENABLED=false delegates browser access control to the deployment,
  // but it must never turn an x-api-key into a key-management credential.
  router.use('/api/keys', (req, res, next) => {
    if (req.headers['x-api-key']) {
      return res.status(403).json({ error: 'API keys cannot manage other API keys' });
    }
    return next();
  });

  /**
   * @swagger
   * /api/keys:
   *   get:
   *     summary: List API keys
   *     description: Get all API keys (without the actual key values). Only accessible via session auth.
   *     tags: [API Keys]
   *     responses:
   *       200:
   *         description: List of API keys
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 keys:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: integer
   *                       name:
   *                         type: string
   *                       key_prefix:
   *                         type: string
   *                       created_at:
   *                         type: string
   *                         format: date-time
   *                       last_used_at:
   *                         type: string
   *                         format: date-time
   *                       is_active:
   *                         type: boolean
   *       403:
   *         description: API keys cannot manage other API keys
   */
  router.get('/api/keys', verifyToken, async (req, res) => {
    // Only allow session-based auth for managing keys
    if (req.authType === 'api_key') {
      return res.status(403).json({ error: 'API keys cannot manage other API keys' });
    }

    try {
      const keys = await apiKeyModule.listApiKeys();
      res.json({ keys });
    } catch (error) {
      req.log.error({ err: error }, 'Failed to list API keys');
      res.status(500).json({ error: 'Failed to list API keys' });
    }
  });

  /**
   * @swagger
   * /api/keys:
   *   post:
   *     summary: Create API key
   *     description: Generate a new API key. The key is only shown once! Only accessible via session auth.
   *     tags: [API Keys]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *             properties:
   *               name:
   *                 type: string
   *                 maxLength: 100
   *                 description: Human-readable name for the key
   *               policy:
   *                 $ref: '#/components/schemas/ExternalApiKeyPolicy'
   *               channelIds:
   *                 type: array
   *                 uniqueItems: true
   *                 items: { type: integer, minimum: 1 }
   *                 description: Exact initial grant set for a constrained key
   *     responses:
   *       200:
   *         description: API key created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 id:
   *                   type: integer
   *                 name:
   *                   type: string
   *                 key:
   *                   type: string
   *                   description: The full API key (only shown once!)
   *                 prefix:
   *                   type: string
   *       400:
   *         description: Invalid name
   *       403:
   *         description: API keys cannot create other API keys
   */
  router.post('/api/keys', verifyToken, async (req, res) => {
    if (req.authType === 'api_key') {
      return res.status(403).json({ error: 'API keys cannot create other API keys' });
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
        Object.keys(req.body).some((field) => !['name', 'policy', 'channelIds'].includes(field))) {
      return res.status(400).json({ error: 'Request body contains unsupported fields' });
    }
    const { name, policy, channelIds } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 1 || name.length > 100) {
      return res.status(400).json({ error: 'Name is required (1-100 characters)' });
    }

    // Sanitize name: remove control characters, trim whitespace
    // eslint-disable-next-line no-control-regex
    const sanitizedName = name.trim().replace(/[\x00-\x1F\x7F]/g, '');
    
    // Validate sanitized name still has content
    if (sanitizedName.length < 1) {
      return res.status(400).json({ error: 'Name contains only invalid characters' });
    }

    try {
      let result;
      if (policy === undefined) {
        if (channelIds !== undefined) {
          return res.status(400).json({
            error: 'channelIds can only be supplied for an external API key',
          });
        }
        result = await apiKeyModule.createApiKey(sanitizedName);
      } else {
        result = await sequelize.transaction(async (transaction) => {
          const created = await apiKeyModule.createApiKey(
            sanitizedName,
            policy,
            { transaction, logEvent: false }
          );
          await apiKeyChannelGrantModule.replaceChannelGrants(
            created.id,
            channelIds ?? [],
            { transaction }
          );
          return created;
        });
        try {
          apiKeyModule.logApiKeyCreated({
            id: result.id,
            name: result.name,
            prefix: result.prefix,
          });
        } catch (logError) {
          req.log?.warn(
            { err: logError, keyId: result.id },
            'API key was created but its audit log event failed'
          );
        }
      }
      res.json({
        success: true,
        message: 'API key created. Save this key - it will not be shown again!',
        ...result
      });
    } catch (error) {
      req.log.error({ err: error }, 'Failed to create API key');
      if (error.message.includes('Maximum number') || isPolicyValidationError(error)) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to create API key' });
    }
  });

  router.patch('/api/keys/:id', verifyToken, async (req, res) => {
    if (req.authType === 'api_key') {
      return res.status(403).json({ error: 'API keys cannot manage other API keys' });
    }
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid API key ID' });
    try {
      const key = await apiKeyModule.updateApiKey(id, req.body?.policy);
      if (!key) return res.status(404).json({ error: 'API key not found' });
      return res.json({ success: true, key: apiKeyModule.serializeApiKey(key) });
    } catch (error) {
      if (isPolicyValidationError(error)) {
        return res.status(400).json({ error: error.message });
      }
      req.log.error({ err: error }, 'Failed to update API key policy');
      return res.status(500).json({ error: 'Failed to update API key' });
    }
  });

  router.get('/api/keys/:id/channels', verifyToken, async (req, res) => {
    if (req.authType === 'api_key') {
      return res.status(403).json({ error: 'API keys cannot manage channel grants' });
    }
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid API key ID' });
    }
    try {
      const grants = await apiKeyChannelGrantModule.getChannelGrants(id);
      if (!grants) return res.status(404).json({ error: 'API key not found' });
      return res.json(grants);
    } catch (error) {
      if (error.message.includes('Only active external API keys')) {
        return res.status(400).json({ error: error.message });
      }
      req.log.error({ err: error }, 'Failed to list API key channel grants');
      return res.status(500).json({ error: 'Failed to list channel grants' });
    }
  });

  router.put('/api/keys/:id/channels', verifyToken, async (req, res) => {
    if (req.authType === 'api_key') {
      return res.status(403).json({ error: 'API keys cannot manage channel grants' });
    }
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid API key ID' });
    }
    try {
      const grants = await apiKeyChannelGrantModule.replaceChannelGrants(id, req.body?.channelIds);
      if (!grants) return res.status(404).json({ error: 'API key not found' });
      return res.json({ success: true, ...grants });
    } catch (error) {
      if (error.message.includes('channelIds') || error.message.includes('enabled channel') ||
          error.message.includes('Only active external API keys')) {
        return res.status(400).json({ error: error.message });
      }
      req.log.error({ err: error }, 'Failed to replace API key channel grants');
      return res.status(500).json({ error: 'Failed to replace channel grants' });
    }
  });

  /**
   * @swagger
   * /api/keys/{id}/external-access:
   *   put:
   *     summary: Atomically replace a constrained key policy and channel grants
   *     tags: [API Keys]
   *     security: [{ SessionAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: integer, minimum: 1 }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [policy, channelIds]
   *             additionalProperties: false
   *             properties:
   *               policy:
   *                 $ref: '#/components/schemas/ExternalApiKeyPolicy'
   *               channelIds:
   *                 type: array
   *                 uniqueItems: true
   *                 items: { type: integer, minimum: 1 }
   *     responses:
   *       200: { description: Policy and exact grant set committed }
   *       400: { description: Invalid policy or channel grant set }
   *       403: { description: Session authentication is required }
   *       404: { description: Active constrained key not found }
   */
  router.put('/api/keys/:id/external-access', verifyToken, async (req, res) => {
    if (req.authType === 'api_key') {
      return res.status(403).json({ error: 'API keys cannot manage other API keys' });
    }
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid API key ID' });
    }
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
        Object.keys(req.body).some((field) => !['policy', 'channelIds'].includes(field))) {
      return res.status(400).json({ error: 'Request body contains unsupported fields' });
    }
    try {
      const result = await sequelize.transaction(async (transaction) => {
        const key = await apiKeyModule.updateApiKey(
          id,
          req.body.policy,
          { transaction }
        );
        if (!key) return null;
        const grants = await apiKeyChannelGrantModule.replaceChannelGrants(
          id,
          req.body.channelIds,
          { transaction }
        );
        return { key, grants };
      });
      if (!result) return res.status(404).json({ error: 'API key not found' });
      return res.json({
        success: true,
        key: apiKeyModule.serializeApiKey(result.key),
        channelIds: result.grants.channelIds,
      });
    } catch (error) {
      if (isPolicyValidationError(error)) {
        return res.status(400).json({ error: error.message });
      }
      req.log.error({ err: error }, 'Failed to update external API access');
      return res.status(500).json({ error: 'Failed to update external access' });
    }
  });

  router.post('/api/keys/:id/regenerate', verifyToken, async (req, res) => {
    if (req.authType === 'api_key') {
      return res.status(403).json({ error: 'API keys cannot manage other API keys' });
    }
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid API key ID' });
    }
    if (req.body && (typeof req.body !== 'object' || Array.isArray(req.body) ||
        Object.keys(req.body).length > 0)) {
      return res.status(400).json({ error: 'Request body must be empty' });
    }

    try {
      const result = await apiKeyModule.regenerateApiKey(id);
      if (!result) return res.status(404).json({ error: 'Active API key not found' });
      return res.json({
        success: true,
        message: 'API key regenerated. Save this key - it will not be shown again!',
        ...result,
      });
    } catch (error) {
      req.log.error({ err: error }, 'Failed to regenerate API key');
      return res.status(500).json({ error: 'Failed to regenerate API key' });
    }
  });

  /**
   * @swagger
   * /api/keys/{id}:
   *   delete:
   *     summary: Revoke API key
   *     description: Revoke an API key while retaining it for audit. Only accessible via session auth.
   *     tags: [API Keys]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: API key ID
   *     responses:
   *       200:
   *         description: API key revoked successfully
   *       403:
   *         description: API keys cannot revoke other API keys
   *       404:
   *         description: API key not found
   */
  router.delete('/api/keys/:id', verifyToken, async (req, res) => {
    if (req.authType === 'api_key') {
      return res.status(403).json({ error: 'API keys cannot revoke other API keys' });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid API key ID' });
    }

    try {
      const success = await apiKeyModule.deleteApiKey(id);
      if (success) {
        res.json({ success: true, message: 'API key revoked' });
      } else {
        res.status(404).json({ error: 'API key not found' });
      }
    } catch (error) {
      req.log.error({ err: error }, 'Failed to revoke API key');
      res.status(500).json({ error: 'Failed to revoke API key' });
    }
  });

  return router;
};
