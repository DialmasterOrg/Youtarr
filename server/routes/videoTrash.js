const express = require('express');

// A selection can name this many videos at once.
const MAX_SELECTION_SIZE = 1000;
const PURGE_STATES = ['deleted', 'missing'];

const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

/**
 * Routes for the trash: videos with no file left (deleted by Youtarr, or
 * missing from disk). See modules/videoTrashModule.js.
 * @param {Object} deps
 * @param {Function} deps.verifyToken
 * @param {Object} deps.videoTrashModule
 * @param {Object} deps.jobModule - Download History holds jobs in memory; a purge reloads the affected ones
 */
module.exports = function createVideoTrashRoutes({ verifyToken, videoTrashModule, jobModule }) {
  const router = express.Router();

  /**
   * @swagger
   * /api/videos/removed-summary:
   *   get:
   *     summary: Count the videos whose file is gone
   *     description: >
   *       Deleted = Youtarr removed the file (a delete in the app, automatic cleanup, or a missing video the user
   *       marked as deleted), including videos removed before Youtarr recorded why (`legacy`, a subset of `deleted`).
   *       Missing = a file was expected on disk and not found. `libraryCheck` says whether the downloads folder
   *       looks mounted; while it does not, actions over all missing videos are refused.
   *     tags: [Videos]
   *     responses:
   *       200:
   *         description: The counts and the library check
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 deleted:
   *                   type: integer
   *                 missing:
   *                   type: integer
   *                 legacy:
   *                   type: integer
   *                 libraryCheck:
   *                   type: object
   *                   properties:
   *                     ok:
   *                       type: boolean
   *                     reason:
   *                       type: string
   *                       nullable: true
   *                       enum: [missing, empty, unreadable, subfolder-empty]
   *                     path:
   *                       type: string
   *                       nullable: true
   *                     message:
   *                       type: string
   *                       nullable: true
   *       401:
   *         description: Authentication required
   *       500:
   *         description: The counts could not be read
   */
  router.get('/api/videos/removed-summary', verifyToken, async (req, res) => {
    try {
      res.json(await videoTrashModule.getRemovedSummary());
    } catch (err) {
      req.log.error({ err }, 'Failed to read the removed video summary');
      res.status(500).json({ error: 'Failed to read the deleted and missing video counts' });
    }
  });

  /**
   * @swagger
   * /api/videos/mark-deleted:
   *   post:
   *     summary: Mark missing videos as deleted
   *     description: >
   *       Turns missing videos (a file was expected on disk and not found) into deleted ones, which the Videos page
   *       hides by default. Only missing rows change; present and deleted ids in a selection are left alone.
   *       The records are kept, so the videos can still be re-downloaded, and a file that turns up again is marked
   *       downloaded by the rescan. Send either `videoIds` or `all: true`.
   *     tags: [Videos]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               videoIds:
   *                 type: array
   *                 minItems: 1
   *                 maxItems: 1000
   *                 items:
   *                   type: integer
   *                 description: Database video ids to mark
   *               all:
   *                 type: boolean
   *                 description: Mark every missing video
   *     responses:
   *       200:
   *         description: How many videos were marked
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 updated:
   *                   type: integer
   *       400:
   *         description: Neither a valid selection nor all, or both
   *       401:
   *         description: Authentication required
   *       409:
   *         description: all was asked for while the downloads folder looks unmounted (reason library-unavailable); the videos may be fine
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                 reason:
   *                   type: string
   *                   enum: [library-unavailable]
   *       500:
   *         description: The videos could not be marked
   */
  router.post('/api/videos/mark-deleted', verifyToken, async (req, res) => {
    const { videoIds, all } = req.body || {};
    const wantsAll = all === true;
    const selection = Array.isArray(videoIds)
      && videoIds.length >= 1
      && videoIds.length <= MAX_SELECTION_SIZE
      && videoIds.every(isPositiveInteger)
      ? videoIds
      : null;

    if ((wantsAll && videoIds !== undefined) || (!wantsAll && !selection)) {
      return res.status(400).json({ error: `Send either videoIds (1 to ${MAX_SELECTION_SIZE} video ids) or all: true` });
    }

    try {
      const result = await videoTrashModule.markMissingAsDeleted({ videoIds: wantsAll ? null : selection, all: wantsAll });
      res.json(result);
    } catch (err) {
      if (err.code === 'LIBRARY_UNAVAILABLE') {
        return res.status(409).json({ error: err.message, reason: 'library-unavailable' });
      }
      req.log.error({ err, all: wantsAll, count: selection ? selection.length : null }, 'Failed to mark videos as deleted');
      res.status(500).json({ error: 'Failed to mark videos as deleted' });
    }
  });

  /**
   * @swagger
   * /api/videos/purge-removed:
   *   post:
   *     summary: Empty the trash
   *     description: >
   *       Forgets deleted and/or missing videos entirely. This cannot be undone. For each video it removes the
   *       database record (so it leaves the Videos page and Download History and its channel and playlist pages
   *       show it as not downloaded), the watch history Youtarr synced for it from media servers, the playlist
   *       download date, and the cached metadata and thumbnail. Nothing on disk under the downloads folder is
   *       touched; a missing video's file that turns up later is not recognised. With `removeFromArchive` the
   *       videos also leave the download archive (`complete.list`), so automatic channel and playlist downloads
   *       treat them as new and may download them again; without it they keep being skipped.
   *     tags: [Videos]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [states, removeFromArchive]
   *             properties:
   *               states:
   *                 type: array
   *                 minItems: 1
   *                 items:
   *                   type: string
   *                   enum: [deleted, missing]
   *               removeFromArchive:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: What was removed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 purged:
   *                   type: integer
   *                 archiveEntriesRemoved:
   *                   type: integer
   *                 jobsAffected:
   *                   type: integer
   *                   description: Download History jobs that lost videos
   *       400:
   *         description: Invalid states or archive choice
   *       401:
   *         description: Authentication required
   *       409:
   *         description: Another purge is running (reason running), downloads are using the archive (reason archive-busy), or missing videos were included while the downloads folder looks unmounted (reason library-unavailable)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                 reason:
   *                   type: string
   *                   enum: [running, library-unavailable, archive-busy]
   *       500:
   *         description: The purge failed; rows already purged stay purged
   */
  router.post('/api/videos/purge-removed', verifyToken, async (req, res) => {
    const { states, removeFromArchive } = req.body || {};
    const validStates = Array.isArray(states)
      && states.length > 0
      && states.every((state) => PURGE_STATES.includes(state))
      && new Set(states).size === states.length;
    if (!validStates || typeof removeFromArchive !== 'boolean') {
      return res.status(400).json({ error: 'Send states (deleted and/or missing) and removeFromArchive (true or false)' });
    }

    try {
      const result = await videoTrashModule.purgeRemoved(
        { states, removeFromArchive },
        { reloadJobVideos: (jobIds) => jobModule.reloadJobVideos(jobIds) }
      );
      res.json({ purged: result.purged, archiveEntriesRemoved: result.archiveEntriesRemoved, jobsAffected: result.jobIds.length });
    } catch (err) {
      if (err.code === 'PURGE_RUNNING') {
        return res.status(409).json({ error: err.message, reason: 'running' });
      }
      if (err.code === 'ARCHIVE_BUSY') {
        return res.status(409).json({ error: err.message, reason: 'archive-busy' });
      }
      if (err.code === 'LIBRARY_UNAVAILABLE') {
        return res.status(409).json({ error: err.message, reason: 'library-unavailable' });
      }
      req.log.error({ err, states, removeFromArchive }, 'Failed to empty the trash');
      res.status(500).json({ error: 'Failed to empty the trash' });
    }
  });

  return router;
};
