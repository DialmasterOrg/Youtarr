const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const userNameMaxLength = 32;
const passwordMaxLength = 64;

/**
 * Creates authentication routes
 * @param {Object} deps - Dependencies
 * @param {Function} deps.verifyToken - Token verification middleware
 * @param {Function} deps.loginLimiter - Login rate limiter middleware
 * @param {Object} deps.configModule - Config module
 * @returns {express.Router}
 */
module.exports = function createAuthRoutes({ verifyToken, loginLimiter, configModule }) {
  /**
   * @swagger
   * /validateToken:
   *   get:
   *     summary: Validate token
   *     description: Check if the current session token is valid.
   *     tags: [Authentication]
   *     responses:
   *       200:
   *         description: Token is valid
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 valid:
   *                   type: boolean
   *                 username:
   *                   type: string
   *       401:
   *         description: Invalid or expired token
   *       403:
   *         description: No token provided
   */
  router.get('/validateToken', verifyToken, (req, res) => {
    res.json({ valid: true, username: req.username });
  });

  /**
   * @swagger
   * /auth/login:
   *   post:
   *     summary: User login
   *     description: Authenticate with username and password to receive a session token.
   *     tags: [Authentication]
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
   *                 maxLength: 64
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *                   description: Session token to use in x-access-token header
   *                 expires:
   *                   type: string
   *                   format: date-time
   *                 username:
   *                   type: string
   *       401:
   *         description: Invalid credentials
   *       429:
   *         description: Too many failed login attempts
   *       503:
   *         description: Authentication not configured
   */
  router.post('/auth/login', loginLimiter, async (req, res) => {
    if (process.env.AUTH_ENABLED === 'false') {
      return res.json({
        token: 'platform-managed-auth',
        message: 'Authentication is managed by the platform'
      });
    }

    const { username, password } = req.body;

    if (!username || typeof username !== 'string' || username.length > userNameMaxLength) {
      return res.status(400).json({ error: 'Invalid username' });
    }

    if (!password || typeof password !== 'string' || password.length > passwordMaxLength) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    const config = configModule.getConfig();

    if (!config.username || !config.passwordHash) {
      return res.status(503).json({
        error: 'Authentication not configured',
        requiresSetup: true
      });
    }

    if (username !== config.username) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, config.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const sessionToken = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const clientIP = req.ip || req.connection.remoteAddress;

    await db.Session.create({
      session_token: sessionToken,
      username: username,
      user_agent: req.headers['user-agent'],
      ip_address: clientIP,
      expires_at: expiresAt
    });

    res.json({
      token: sessionToken,
      expires: expiresAt.toISOString(),
      username: username
    });
  });

  /**
   * @swagger
   * /auth/logout:
   *   post:
   *     summary: User logout
   *     description: Invalidate the current session token.
   *     tags: [Authentication]
   *     responses:
   *       200:
   *         description: Logout successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *       403:
   *         description: No token provided
   */
  router.post('/auth/logout', verifyToken, async (req, res) => {
    const token = req.headers['x-access-token'];

    await db.Session.update(
      { is_active: false },
      { where: { session_token: token } }
    );

    res.json({ success: true });
  });

  /**
   * @swagger
   * /auth/sessions:
   *   get:
   *     summary: Get active sessions
   *     description: Retrieve all active sessions for the current user.
   *     tags: [Authentication]
   *     responses:
   *       200:
   *         description: List of active sessions
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: integer
   *                   user_agent:
   *                     type: string
   *                   ip_address:
   *                     type: string
   *                   createdAt:
   *                     type: string
   *                     format: date-time
   *                   last_used_at:
   *                     type: string
   *                     format: date-time
   */
  router.get('/auth/sessions', verifyToken, async (req, res) => {
    const sessions = await db.Session.findAll({
      where: {
        username: req.username,
        is_active: true,
        expires_at: {
          [db.Sequelize.Op.gt]: new Date()
        }
      },
      attributes: ['id', 'user_agent', 'ip_address', 'createdAt', 'last_used_at'],
      order: [['last_used_at', 'DESC']]
    });

    res.json(sessions);
  });

  /**
   * @swagger
   * /auth/sessions/{id}:
   *   delete:
   *     summary: Delete session
   *     description: Invalidate a specific session.
   *     tags: [Authentication]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Session ID
   *     responses:
   *       200:
   *         description: Session deleted successfully
   *       404:
   *         description: Session not found
   */
  router.delete('/auth/sessions/:id', verifyToken, async (req, res) => {
    const result = await db.Session.update(
      { is_active: false },
      {
        where: {
          id: req.params.id,
          username: req.username
        }
      }
    );

    if (result[0] === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true });
  });

  /**
   * @swagger
   * /auth/change-password:
   *   post:
   *     summary: Change password
   *     description: Change the current user's password.
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - currentPassword
   *               - newPassword
   *             properties:
   *               currentPassword:
   *                 type: string
   *               newPassword:
   *                 type: string
   *                 minLength: 8
   *                 maxLength: 64
   *     responses:
   *       200:
   *         description: Password changed successfully
   *       400:
   *         description: Invalid password format
   *       401:
   *         description: Current password is incorrect
   */
  router.post('/auth/change-password', verifyToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || typeof currentPassword !== 'string' || currentPassword.length > passwordMaxLength) {
      return res.status(400).json({ error: 'Invalid current password' });
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Invalid new password' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    if (newPassword.length > passwordMaxLength) {
      return res.status(400).json({ error: 'New password is too long' });
    }

    const config = configModule.getConfig();

    const validPassword = await bcrypt.compare(currentPassword, config.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    config.passwordHash = newPasswordHash;
    configModule.updateConfig(config);

    res.json({ success: true, message: 'Password updated successfully' });
  });

  /**
   * @swagger
   * /auth/validate:
   *   get:
   *     summary: Validate authentication
   *     description: Check if the current session is valid.
   *     tags: [Authentication]
   *     responses:
   *       200:
   *         description: Session is valid
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 valid:
   *                   type: boolean
   *                 username:
   *                   type: string
   *       401:
   *         description: Invalid or expired token
   *       403:
   *         description: No token provided
   */
  router.get('/auth/validate', verifyToken, (req, res) => {
    res.json({ valid: true, username: req.username });
  });

  return router;
};

