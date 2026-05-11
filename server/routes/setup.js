const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const logger = require('../logger');
const { isAuthConfigured } = require('../modules/authState');

/**
 * Creates setup routes.
 *
 * @param {Object} deps - Dependencies
 * @param {Object} deps.configModule - Config module
 * @param {Object} deps.setupTokenModule - Setup token module
 * @param {Function} deps.setupCreateAuthLimiter - Rate limiter for setup attempts
 * @param {Function} deps.getClientAddress - Function to resolve the client address
 * @returns {express.Router}
 */
module.exports = function createSetupRoutes({ configModule, setupTokenModule, setupCreateAuthLimiter, getClientAddress }) {
  const requiredSetupTokenMethods = ['verify', 'claimForSetup', 'consume', 'releaseSetupClaim'];
  const hasRequiredSetupTokenMethods = setupTokenModule &&
    requiredSetupTokenMethods.every((method) => typeof setupTokenModule[method] === 'function');

  if (!hasRequiredSetupTokenMethods) {
    throw new Error('setupTokenModule dependency is required');
  }
  if (typeof setupCreateAuthLimiter !== 'function') {
    throw new Error('setupCreateAuthLimiter dependency is required');
  }
  if (typeof getClientAddress !== 'function') {
    throw new Error('getClientAddress dependency is required');
  }

  const restoreAuthFields = (config, previousAuth) => {
    if (!config || !previousAuth) return;

    if (previousAuth.hadUsername) {
      config.username = previousAuth.username;
    } else {
      delete config.username;
    }

    if (previousAuth.hadPasswordHash) {
      config.passwordHash = previousAuth.passwordHash;
    } else {
      delete config.passwordHash;
    }
  };

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
   *                 platformManaged:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                   nullable: true
   */
  router.get('/setup/status', (req, res) => {
    if (process.env.AUTH_ENABLED === 'false') {
      return res.json({
        requiresSetup: false,
        platformManaged: true,
        message: 'Authentication is managed by the platform'
      });
    }

    const config = configModule.getConfig();
    const requiresSetup = !isAuthConfigured(config);

    res.json({
      requiresSetup,
      platformManaged: false,
      message: null
    });
  });

  /**
   * @swagger
   * /setup/create-auth:
   *   post:
   *     summary: Create initial authentication
   *     description: Set up the initial admin username and password. Requires the one-time setup token printed to the container logs and stored in the data volume at config/setup-token.
   *     tags: [Setup]
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [token, username, password]
   *             properties:
   *               token:
   *                 type: string
   *                 description: One-time setup token
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
   *       400:
   *         description: Invalid input or already configured
   *       401:
   *         description: Invalid setup token
   */
  router.post('/setup/create-auth', setupCreateAuthLimiter, async (req, res) => {
    let setupClaimed = false;
    let tokenConsumed = false;
    let credentialsPersisted = false;
    let authFieldsMutated = false;
    let mutatedConfig = null;
    let previousAuth = null;

    try {
      const config = configModule.getConfig();
      const { token, username, password } = req.body;
      const clientIP = getClientAddress(req);

      // Keep token verification first. After setup completes the token is consumed, so
      // replays should receive the same 401 as token-less probes instead of learning
      // whether credentials are already configured.
      if (!setupTokenModule.verify(token)) {
        logger.warn(
          { event: 'setup_token_invalid', ip: clientIP, userAgent: req.headers['user-agent'] },
          'Setup attempt with missing or invalid token'
        );
        return res.status(401).json({ error: 'Invalid setup token' });
      }

      if (isAuthConfigured(config)) {
        return res.status(400).json({ error: 'Authentication already configured' });
      }

      if (!username || typeof username !== 'string' || username.trim().length === 0) {
        return res.status(400).json({ error: 'Username is required' });
      }

      const trimmedUsername = username.trim();

      if (trimmedUsername.length > 32) {
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

      // claimForSetup repeats token verification to reject concurrent valid submissions.
      if (!setupTokenModule.claimForSetup(token)) {
        logger.warn(
          { event: 'setup_token_invalid_or_consumed', ip: clientIP, userAgent: req.headers['user-agent'] },
          'Setup attempt with invalid or already consumed token'
        );
        return res.status(401).json({ error: 'Invalid setup token' });
      }
      setupClaimed = true;

      const passwordHash = await bcrypt.hash(password, 10);

      mutatedConfig = config;
      previousAuth = {
        hadUsername: Object.prototype.hasOwnProperty.call(config, 'username'),
        username: config.username,
        hadPasswordHash: Object.prototype.hasOwnProperty.call(config, 'passwordHash'),
        passwordHash: config.passwordHash
      };
      config.username = trimmedUsername;
      config.passwordHash = passwordHash;
      authFieldsMutated = true;
      configModule.updateConfig(config);
      credentialsPersisted = true;

      const sessionToken = uuidv4();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await db.Session.create({
        session_token: sessionToken,
        username: trimmedUsername,
        user_agent: req.headers['user-agent'],
        ip_address: clientIP,
        expires_at: expiresAt
      });

      setupTokenModule.consume();
      tokenConsumed = true;

      logger.info({ username: trimmedUsername }, 'Initial setup completed for user');

      res.json({
        token: sessionToken,
        message: 'Setup complete! You can now access Youtarr normally.',
        username: trimmedUsername
      });
    } catch (err) {
      if (authFieldsMutated && !credentialsPersisted) {
        restoreAuthFields(mutatedConfig || configModule.getConfig(), previousAuth);
      }

      const setupCompletedWithoutSession = credentialsPersisted && isAuthConfigured(configModule.getConfig());

      if (setupCompletedWithoutSession && !tokenConsumed) {
        setupTokenModule.consume();
        tokenConsumed = true;
      }

      if (setupClaimed && !tokenConsumed) {
        setupTokenModule.releaseSetupClaim();
      }
      logger.error({ err }, 'Initial setup failed');
      if (!res.headersSent) {
        if (setupCompletedWithoutSession) {
          return res.status(500).json({
            error: 'Setup saved your credentials but the session could not be created. Please log in with the credentials you just entered.'
          });
        }
        res.status(500).json({ error: 'Setup failed' });
      }
    }
  });

  return router;
};
