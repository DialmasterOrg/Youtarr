const express = require('express');
const logger = require('../logger');
const { validateSubFolderName } = require('../modules/filesystem/subfolderValidation');
const { GLOBAL_DEFAULT_SENTINEL, ROOT_SENTINEL } = require('../modules/filesystem/constants');

const LAYOUTS = new Set(['videos', 'tv']);

/**
 * Subfolder registry routes (session-auth only).
 * @param {Object} deps
 * @param {Function} deps.verifyToken
 * @param {Object} deps.subfolderModule
 * @param {Object} deps.libraryFolders - tvShows/libraryFolders (creates folders with a layout)
 * @param {Object} deps.layoutGuards - tvShows/layoutGuards (refusal bodies)
 * @param {Object} deps.jobModule - Its running job blocks layout switches
 * @returns {express.Router}
 */
function createSubfolderRoutes({ verifyToken, subfolderModule, libraryFolders, layoutGuards, jobModule }) {
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
   *     summary: Create a library folder
   *     description: Creates the __name directory in the downloads folder and registers the folder with a layout (Videos when omitted for a new name; an existing folder keeps its layout unless one is given). A directory that already holds files is registered as Videos (existingContent true); asking for TV there, or for a different layout of an existing folder that holds downloads, answers 409 reorganizeRequired with the folderLayout change to review. The folder pickers' inline add sends no layout.
   *     tags: [Subfolders]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name]
   *             properties:
   *               name: { type: string }
   *               layout: { type: string, enum: [videos, tv] }
   *     responses:
   *       201: { description: "Created: { name, layout, created: true, existingContent }" }
   *       200: { description: "Already existed: { name, layout, created: false }" }
   *       400: { description: Invalid name (including the reserved playlists) or layout }
   *       409: { description: "Its downloads must move (reorganizeRequired, with change), or a download, a reorganize or MP3 channels refuse the layout" }
   *       500: { description: "Couldn't create the directory, or the folder couldn't be saved" }
   */
  router.post('/api/subfolders', verifyToken, async (req, res) => {
    const { name, layout } = req.body || {};
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
    if (layout !== undefined && layout !== null && !LAYOUTS.has(layout)) {
      return res.status(400).json({ error: 'layout must be "videos" or "tv"' });
    }
    try {
      const result = await libraryFolders.createLibraryFolder(name.trim(), layout || null, {
        isDownloadRunning: () => Boolean(jobModule.getInProgressJobId()),
      });
      return res.status(result.created ? 201 : 200).json(result);
    } catch (error) {
      if (error.status) return res.status(error.status).json(layoutGuards.errorBody(error));
      logger.error({ err: error, name }, 'Failed to create the folder');
      return res.status(500).json({ error: 'Failed to create the folder' });
    }
  });

  /**
   * @swagger
   * /api/subfolders/{name}:
   *   delete:
   *     summary: Delete a subfolder
   *     description: Deletes a library folder only when it is empty on disk and no channel (enabled or not), playlist or numbered TV show uses it and it is not the default folder. Its Plex refresh mapping is removed with it. A folder known only from a Plex mapping is deleted too.
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
