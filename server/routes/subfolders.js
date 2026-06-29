const express = require('express');
const logger = require('../logger');
const { validateSubFolderName } = require('../modules/filesystem/subfolderValidation');
const { GLOBAL_DEFAULT_SENTINEL, ROOT_SENTINEL } = require('../modules/filesystem/constants');

/**
 * Subfolder registry routes (session-auth only).
 * @param {Object} deps
 * @param {Function} deps.verifyToken
 * @param {Object} deps.subfolderModule
 * @returns {express.Router}
 */
function createSubfolderRoutes({ verifyToken, subfolderModule }) {
  const router = express.Router();

  /**
   * @swagger
   * /api/subfolders:
   *   get:
   *     summary: List subfolders with usage
   *     description: Returns every known subfolder with where it is used (channels, playlists, global default, Plex mapping, downloaded files) and whether it can be deleted.
   *     tags: [Subfolders]
   *     responses:
   *       200: { description: List of subfolders with usage metadata }
   */
  router.get('/api/subfolders', verifyToken, async (req, res) => {
    try {
      const items = await subfolderModule.getUsage();
      return res.json(items);
    } catch (error) {
      logger.error({ err: error }, 'Failed to list subfolders');
      return res.status(500).json({ error: 'Failed to list subfolders' });
    }
  });

  /**
   * @swagger
   * /api/subfolders:
   *   post:
   *     summary: Create (register) a subfolder
   *     description: Persists a subfolder name so it is available in every picker.
   *     tags: [Subfolders]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name: { type: string }
   *     responses:
   *       200: { description: Registered }
   *       400: { description: Invalid name }
   */
  router.post('/api/subfolders', verifyToken, async (req, res) => {
    try {
      const { name } = req.body || {};
      if (typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Subfolder name is required' });
      }
      if (name === GLOBAL_DEFAULT_SENTINEL || name === ROOT_SENTINEL) {
        return res.status(400).json({ error: 'Invalid subfolder name' });
      }
      const validation = validateSubFolderName(name);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      await subfolderModule.register(name.trim());
      return res.json({ name: name.trim() });
    } catch (error) {
      logger.error({ err: error }, 'Failed to create subfolder');
      return res.status(500).json({ error: 'Failed to create subfolder' });
    }
  });

  /**
   * @swagger
   * /api/subfolders/{name}:
   *   delete:
   *     summary: Delete a subfolder
   *     description: Deletes a subfolder only when it is empty on disk and unused by any channel, playlist, the global default, or a Plex mapping.
   *     tags: [Subfolders]
   *     parameters:
   *       - in: path
   *         name: name
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Deleted }
   *       400: { description: Invalid name }
   *       404: { description: Not found }
   *       409: { description: In use or not empty }
   */
  router.delete('/api/subfolders/:name', verifyToken, async (req, res) => {
    const name = req.params.name; // Express has already URL-decoded this
    const validation = validateSubFolderName(name);
    if (!name || name === GLOBAL_DEFAULT_SENTINEL || name === ROOT_SENTINEL || !validation.valid) {
      return res.status(400).json({ error: validation.error || 'Invalid subfolder name' });
    }
    try {
      await subfolderModule.delete(name);
      return res.json({ deleted: true });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      logger.error({ err: error, name }, 'Failed to delete subfolder');
      return res.status(500).json({ error: 'Failed to delete subfolder' });
    }
  });

  return router;
}

module.exports = createSubfolderRoutes;
