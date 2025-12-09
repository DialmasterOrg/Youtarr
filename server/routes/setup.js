const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const logger = require('../logger');

/**
 * Creates setup routes
 * @param {Object} deps - Dependencies
 * @param {Object} deps.configModule - Config module
 * @param {Function} deps.isLocalhostIP - Function to check if IP is localhost
 * @returns {express.Router}
 */
module.exports = function createSetupRoutes({ configModule, isLocalhostIP }) {
  /**
   * @swagger
   * /setup/status:
   *   get:
   *     summary: Get setup status
   *     description: Check if initial authentication setup is required.
   *     tags: [Setup]
   *     security: []
   *     responses:
   *       200:
   *         description: Setup status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 requiresSetup:
   *                   type: boolean
   *                 isLocalhost:
   *                   type: boolean
   *                 platformManaged:
   *                   type: boolean
   *                 message:
   *                   type: string
   */
  router.get('/setup/status', (req, res) => {
    if (process.env.AUTH_ENABLED === 'false') {
      return res.json({
        requiresSetup: false,
        isLocalhost: true,
        platformManaged: true,
        message: 'Authentication is managed by the platform'
      });
    }

    const config = configModule.getConfig();
    const clientIP = req.ip ||
                    req.connection.remoteAddress ||
                    req.socket.remoteAddress ||
                    req.connection.socket?.remoteAddress ||
                    req.headers['x-forwarded-for']?.split(',')[0];

    const hostIsLocal = req.headers.host && (
      req.headers.host.startsWith('localhost') ||
      req.headers.host.startsWith('127.0.0.1') ||
      req.headers.host.startsWith('[::1]')
    );

    const isLocalhost = isLocalhostIP(clientIP) || hostIsLocal;

    res.json({
      requiresSetup: !config.username || !config.passwordHash,
      isLocalhost: isLocalhost,
      message: isLocalhost ? null : 'Setup must be performed from localhost'
    });
  });

  /**
   * @swagger
   * /setup/create-auth:
   *   post:
   *     summary: Create initial authentication
   *     description: Set up the initial admin username and password. Only accessible from localhost.
   *     tags: [Setup]
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *               - password
   *             properties:
   *               username:
   *                 type: string
   *                 maxLength: 32
   *               password:
   *                 type: string
   *                 minLength: 8
   *                 maxLength: 64
   *     responses:
   *       200:
   *         description: Setup complete
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *                 message:
   *                   type: string
   *                 username:
   *                   type: string
   *       400:
   *         description: Invalid input or already configured
   *       403:
   *         description: Setup only allowed from localhost
   */
  router.post('/setup/create-auth', async (req, res) => {
    const config = configModule.getConfig();

    const clientIP = req.ip ||
                    req.connection.remoteAddress ||
                    req.socket.remoteAddress ||
                    req.connection.socket?.remoteAddress ||
                    req.headers['x-forwarded-for']?.split(',')[0];

    const hostIsLocal = req.headers.host && (
      req.headers.host.startsWith('localhost') ||
      req.headers.host.startsWith('127.0.0.1') ||
      req.headers.host.startsWith('[::1]')
    );

    const isLocalhost = isLocalhostIP(clientIP) || hostIsLocal;

    if (!isLocalhost) {
      logger.warn({ clientIP }, 'Setup attempt blocked from non-localhost IP');
      return res.status(403).json({
        error: 'Initial setup can only be performed from localhost for security reasons.',
        instruction: 'Please access Youtarr directly from the server at http://localhost:3087',
        yourIP: clientIP
      });
    }

    if (config.username && config.passwordHash) {
      return res.status(400).json({ error: 'Authentication already configured' });
    }

    const { username, password } = req.body;

    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (username.length > 32) {
      return res.status(400).json({ error: 'Username is too long (max 32 characters)' });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (password.length > 64) {
      return res.status(400).json({ error: 'Password is too long' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    config.username = username.trim();
    config.passwordHash = passwordHash;
    configModule.updateConfig(config);

    const sessionToken = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.Session.create({
      session_token: sessionToken,
      username: username.trim(),
      user_agent: req.headers['user-agent'],
      ip_address: clientIP,
      expires_at: expiresAt
    });

    logger.info({ username: username.trim() }, 'Initial setup completed for user');

    res.json({
      token: sessionToken,
      message: 'Setup complete! You can now access Youtarr from anywhere.',
      username: username
    });
  });

  return router;
};

