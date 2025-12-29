const express = require('express');
const router = express.Router();

/**
 * Creates API key management routes
 * @param {Object} deps - Dependencies
 * @param {Function} deps.verifyToken - Token verification middleware
 * @returns {express.Router}
 */
module.exports = function createApiKeyRoutes({ verifyToken }) {
  const apiKeyModule = require('../modules/apiKeyModule');

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

    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 1 || name.length > 100) {
      return res.status(400).json({ error: 'Name is required (1-100 characters)' });
    }

    try {
      const result = await apiKeyModule.createApiKey(name.trim());
      res.json({
        success: true,
        message: 'API key created. Save this key - it will not be shown again!',
        ...result
      });
    } catch (error) {
      req.log.error({ err: error }, 'Failed to create API key');
      if (error.message.includes('Maximum number')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to create API key' });
    }
  });

  /**
   * @swagger
   * /api/keys/{id}:
   *   delete:
   *     summary: Delete API key
   *     description: Permanently delete an API key. Only accessible via session auth.
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
   *         description: API key deleted successfully
   *       403:
   *         description: API keys cannot delete other API keys
   *       404:
   *         description: API key not found
   */
  router.delete('/api/keys/:id', verifyToken, async (req, res) => {
    if (req.authType === 'api_key') {
      return res.status(403).json({ error: 'API keys cannot delete other API keys' });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid API key ID' });
    }

    try {
      const success = await apiKeyModule.deleteApiKey(id);
      if (success) {
        res.json({ success: true, message: 'API key deleted' });
      } else {
        res.status(404).json({ error: 'API key not found' });
      }
    } catch (error) {
      req.log.error({ err: error }, 'Failed to delete API key');
      res.status(500).json({ error: 'Failed to delete API key' });
    }
  });

  return router;
};

