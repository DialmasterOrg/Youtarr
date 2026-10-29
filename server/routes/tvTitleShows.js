const express = require('express');
const logger = require('../logger');

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Title show routes: shows defined on a channel by title patterns, their
 * preview, the show-only download switch, duplicates, and per-video episode
 * assignment.
 * @param {Object} deps
 * @param {Function} deps.verifyToken
 * @param {Object} deps.titleShowService - tvShows/titleShowService
 * @param {Object} deps.models
 * @param {Object} deps.layoutGuards - tvShows/layoutGuards (refusal bodies)
 * @returns {express.Router}
 */
function createTvTitleShowRoutes({ verifyToken, titleShowService, models, layoutGuards }) {
  const router = express.Router();

  // Refusals carry .status (a change that moves files also names the change
  // to preview; a taken folder also suggests a name); anything else is unexpected.
  const sendError = (res, error, failure, context) => {
    if (error.status) {
      return res.status(error.status).json({ ...layoutGuards.errorBody(error), ...(error.details || {}) });
    }
    logger.error({ err: error, ...context }, failure);
    return res.status(500).json({ error: failure });
  };

  const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

  const parseShowId = (req, res) => {
    const showId = Number(req.params.showId);
    if (!Number.isInteger(showId) || showId <= 0) {
      res.status(400).json({ error: 'showId must be a positive whole number' });
      return null;
    }
    return showId;
  };

  // Runs handler(channel) for an existing channel, answering 404 otherwise.
  const withChannel = (failure, handler) => async (req, res) => {
    const { channelId } = req.params;
    try {
      const channel = await models.Channel.findOne({ where: { channel_id: channelId } });
      if (!channel) return res.status(404).json({ error: 'Channel not found' });
      return await handler(channel, req, res);
    } catch (error) {
      return sendError(res, error, failure, { channelId });
    }
  };

  /**
   * @swagger
   * /api/channels/{channelId}/tv/shows:
   *   get:
   *     summary: List a channel's title shows
   *     description: The channel's title shows (removed ones included, marked retired) with their patterns (each with its compiled Python regex), exclude terms, season names and counts (episodes, downloaded, duplicates, not supported yet); the channel's duplicate and classification-error conflicts; whether channel downloads are limited to its shows; the TV folders; and the TV folder a new show uses by default (null when one must be chosen).
   *     tags: [TV Shows]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: The channel's title shows }
   *       404: { description: Channel not found }
   *       500: { description: Failed to load the channel's shows }
   */
  router.get('/api/channels/:channelId/tv/shows', verifyToken, withChannel('Failed to load the channel\'s shows',
    async (channel, req, res) => res.json(await titleShowService.getChannelShows(channel))));

  /**
   * @swagger
   * /api/channels/{channelId}/tv/shows:
   *   post:
   *     summary: Add a title show to a channel
   *     description: Adds a show after the channel's existing ones and classifies the channel's known videos. Episode numbers come from titles (title), upload order (order) or upload time (date, year seasons only). A change that moves downloaded videos is answered with a reorganizeRequired 409 naming the change (type titleShows) to preview through /api/tv/reorganize/preview. A folder another show uses is a 409 with a suggestion (and retiredShowId when a removed show of this channel can be restored instead).
   *     tags: [TV Shows]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, patterns]
   *             properties:
   *               name: { type: string }
   *               folderName: { type: string, description: 'Defaults to the sanitized name' }
   *               libraryFolder: { type: string, description: 'A TV folder ("" = main folder); defaults to the channel''s TV folder, the default subfolder, or the only TV folder' }
   *               excludeTerms: { type: array, items: { type: string } }
   *               seasonNames: { type: object, additionalProperties: { type: string } }
   *               patterns:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     text: { type: string, description: 'Simple syntax ({season}, {episode}, {episode_end}, {part}, {title}, *, leading ^) or a Python regex' }
   *                     kind: { type: string, enum: [simple, regex] }
   *                     seasonSource: { type: string, enum: [title, fixed, year] }
   *                     seasonFixed: { type: integer, minimum: 0, maximum: 199 }
   *                     episodeSource: { type: string, enum: [title, date, order] }
   *     responses:
   *       200: { description: The channel's title shows after the change }
   *       400: { description: Invalid show or pattern }
   *       404: { description: Channel not found }
   *       409: { description: "Downloaded videos move (reorganizeRequired), the folder is taken, or a reorganize is moving the channel's files" }
   *       500: { description: Failed to add the show }
   */
  router.post('/api/channels/:channelId/tv/shows', verifyToken, withChannel('Failed to add the show', async (channel, req, res) => {
    if (!isObject(req.body)) return res.status(400).json({ error: 'The body must be a show' });
    return res.json(await titleShowService.createShow(channel, req.body));
  }));

  /**
   * @swagger
   * /api/channels/{channelId}/tv/shows/order:
   *   put:
   *     summary: Reorder a channel's title shows
   *     description: The first show whose pattern matches a title takes the video, so the order decides between shows. Reclassifies the channel's videos; refusals as for adding a show.
   *     tags: [TV Shows]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [showIds]
   *             properties:
   *               showIds: { type: array, items: { type: integer }, description: 'Every active show of the channel, once' }
   *     responses:
   *       200: { description: The channel's title shows after the change }
   *       400: { description: The list doesn't name every show once }
   *       404: { description: Channel not found }
   *       409: { description: Downloaded videos move (reorganizeRequired) or a reorganize is running }
   *       500: { description: Failed to reorder the shows }
   */
  router.put('/api/channels/:channelId/tv/shows/order', verifyToken, withChannel('Failed to reorder the shows', async (channel, req, res) => {
    const showIds = req.body && req.body.showIds;
    if (!Array.isArray(showIds)) return res.status(400).json({ error: 'showIds must be a list' });
    return res.json(await titleShowService.reorderShows(channel, showIds));
  }));

  /**
   * @swagger
   * /api/channels/{channelId}/tv/shows/{showId}:
   *   put:
   *     summary: Edit a title show
   *     description: Replaces the show's definition (same body as adding a show) and reclassifies the channel's videos. A video that still matches with the same number keeps it; changed numbers, shows and folders of downloaded videos go through the reorganize (reorganizeRequired 409).
   *     tags: [TV Shows]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: showId
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       200: { description: The channel's title shows after the change }
   *       400: { description: Invalid show or pattern }
   *       404: { description: Channel or show not found }
   *       409: { description: Downloaded videos move (reorganizeRequired), the folder is taken, or a reorganize is running }
   *       500: { description: Failed to save the show }
   *   delete:
   *     summary: Remove (retire) a title show
   *     description: The show's videos fall back to the channel's layout (through the reorganize when downloaded); its order and manual numbers are kept for a restore.
   *     tags: [TV Shows]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: showId
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       200: { description: The channel's title shows after the change }
   *       404: { description: Channel or show not found }
   *       409: { description: Downloaded videos move (reorganizeRequired) or a reorganize is running }
   *       500: { description: Failed to remove the show }
   */
  router.put('/api/channels/:channelId/tv/shows/:showId', verifyToken, withChannel('Failed to save the show', async (channel, req, res) => {
    const showId = parseShowId(req, res);
    if (showId === null) return undefined;
    if (!isObject(req.body)) return res.status(400).json({ error: 'The body must be a show' });
    return res.json(await titleShowService.updateShow(channel, showId, req.body));
  }));

  router.delete('/api/channels/:channelId/tv/shows/:showId', verifyToken, withChannel('Failed to remove the show', async (channel, req, res) => {
    const showId = parseShowId(req, res);
    if (showId === null) return undefined;
    return res.json(await titleShowService.retireShow(channel, showId));
  }));

  /**
   * @swagger
   * /api/channels/{channelId}/tv/shows/{showId}/restore:
   *   post:
   *     summary: Restore a removed title show
   *     description: Adds the show back after the channel's active shows, with its folder and kept numbers.
   *     tags: [TV Shows]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: showId
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       200: { description: The channel's title shows after the change }
   *       400: { description: The show isn't removed }
   *       404: { description: Channel or show not found }
   *       409: { description: Downloaded videos move (reorganizeRequired) or a reorganize is running }
   *       500: { description: Failed to restore the show }
   */
  router.post('/api/channels/:channelId/tv/shows/:showId/restore', verifyToken, withChannel('Failed to restore the show', async (channel, req, res) => {
    const showId = parseShowId(req, res);
    if (showId === null) return undefined;
    return res.json(await titleShowService.restoreShow(channel, showId));
  }));

  /**
   * @swagger
   * /api/channels/{channelId}/tv/shows/{showId}/missing:
   *   get:
   *     summary: A title show's missing episodes
   *     description: Per season, the numbered episodes not downloaded yet and the numbers missing between 1 and the highest one (title- and order-numbered seasons only).
   *     tags: [TV Shows]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: showId
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       200: { description: The show's seasons with missing episodes }
   *       404: { description: Channel or show not found }
   *       500: { description: Failed to list the missing episodes }
   */
  router.get('/api/channels/:channelId/tv/shows/:showId/missing', verifyToken, withChannel('Failed to list the missing episodes', async (channel, req, res) => {
    const showId = parseShowId(req, res);
    if (showId === null) return undefined;
    return res.json(await titleShowService.missingEpisodes(channel, showId));
  }));

  /**
   * @swagger
   * /api/channels/{channelId}/tv/preview:
   *   post:
   *     summary: Preview title shows
   *     description: Classifies every known video of the channel with draft shows (the channel's whole set, in order) and optional episode assignments, without saving. Returns per show its episodes with download state, plus duplicates with the upload that keeps the number, gaps per season, compilations and parts not supported yet, unmatched videos, stored episodes that would change, how many downloaded videos would move, and each draft's compiled patterns. Lists are capped; counts are complete.
   *     tags: [TV Shows]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [shows]
   *             properties:
   *               shows: { type: array, items: { type: object }, description: 'Draft shows as for adding one; existing shows carry their id' }
   *               overrides: { type: array, items: { type: object } }
   *     responses:
   *       200: { description: The preview }
   *       400: { description: Invalid show or pattern }
   *       404: { description: Channel not found }
   *       409: { description: A show's folder is taken }
   *       500: { description: Failed to preview the shows }
   */
  router.post('/api/channels/:channelId/tv/preview', verifyToken, withChannel('Failed to preview the shows', async (channel, req, res) => {
    const { shows, overrides = [] } = req.body || {};
    if (!Array.isArray(shows) || !Array.isArray(overrides)) {
      return res.status(400).json({ error: 'shows and overrides must be lists' });
    }
    return res.json(await titleShowService.preview(channel, { shows, overrides }));
  }));

  /**
   * @swagger
   * /api/channels/{channelId}/tv/show-only:
   *   put:
   *     summary: Limit channel downloads to the channel's title shows
   *     description: When on, channel downloads fetch only videos whose title matches one of the channel's title shows (one yt-dlp match filter per show), and Download All queues only videos classified into a show. Ignored while the channel has no shows.
   *     tags: [TV Shows]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [enabled]
   *             properties:
   *               enabled: { type: boolean }
   *     responses:
   *       200: { description: The saved switch }
   *       400: { description: enabled is not a boolean }
   *       404: { description: Channel not found }
   *       500: { description: Failed to save the switch }
   */
  router.put('/api/channels/:channelId/tv/show-only', verifyToken, withChannel('Failed to save the switch', async (channel, req, res) => {
    const enabled = req.body && req.body.enabled;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be true or false' });
    return res.json(await titleShowService.setShowOnly(channel, enabled));
  }));

  /**
   * @swagger
   * /api/channels/{channelId}/tv/conflicts/{youtubeId}/use-copy:
   *   post:
   *     summary: Use a duplicate's copy of an episode instead
   *     description: Gives the duplicate the episode number its holder has (a manual assignment); the holder becomes the duplicate. Through the reorganize (reorganizeRequired 409) when either is downloaded.
   *     tags: [TV Shows]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: youtubeId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: The channel's title shows after the change }
   *       400: { description: Invalid video id }
   *       404: { description: Channel not found, or the video is not a duplicate of the channel }
   *       409: { description: Downloaded videos move (reorganizeRequired) or a reorganize is running }
   *       500: { description: Failed to use the copy }
   */
  router.post('/api/channels/:channelId/tv/conflicts/:youtubeId/use-copy', verifyToken, withChannel('Failed to use the copy', async (channel, req, res) => {
    if (!YOUTUBE_ID.test(req.params.youtubeId)) return res.status(400).json({ error: 'Invalid video id' });
    return res.json(await titleShowService.useDuplicateCopy(channel, req.params.youtubeId));
  }));

  /**
   * @swagger
   * /api/channels/{channelId}/tv/recheck:
   *   post:
   *     summary: Classify a channel's titles again
   *     description: Runs the channel's title shows over its videos again, which clears classification errors (a title that could not be checked when it downloaded). Refusals as for editing a show.
   *     tags: [TV Shows]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: The channel's title shows after the check }
   *       404: { description: Channel not found }
   *       409: { description: Downloaded videos move (reorganizeRequired) or a reorganize is running }
   *       500: { description: Failed to check the titles }
   */
  router.post('/api/channels/:channelId/tv/recheck', verifyToken, withChannel('Failed to check the titles',
    async (channel, req, res) => res.json(await titleShowService.recheck(channel))));

  /**
   * @swagger
   * /api/videos/{youtubeId}/episode:
   *   get:
   *     summary: A video's episode
   *     description: The video's classification (show, status, season and episode, whether it is marked "Not an episode") and the title shows of its channel it can be assigned to.
   *     tags: [TV Shows]
   *     parameters:
   *       - in: path
   *         name: youtubeId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: The video's episode }
   *       400: { description: Invalid video id }
   *       500: { description: Failed to load the episode }
   *   put:
   *     summary: Assign a video's episode by hand
   *     description: Puts the video into one of its channel's title shows with the given season and episode (a manual number classification never changes; a title-numbered holder of that number becomes a duplicate), marks it "Not an episode" (it never joins a title show again), or returns it to automatic classification. Through the reorganize (reorganizeRequired 409) when the video is downloaded and its file moves.
   *     tags: [TV Shows]
   *     parameters:
   *       - in: path
   *         name: youtubeId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               showId: { type: integer }
   *               season: { type: integer, minimum: 0, maximum: 199 }
   *               episode: { type: integer, minimum: 1 }
   *               notAnEpisode: { type: boolean }
   *               automatic: { type: boolean }
   *     responses:
   *       200: { description: The video's episode after the change }
   *       400: { description: Invalid assignment, or the video's channel has no shows }
   *       409: { description: The file moves (reorganizeRequired) or a reorganize is running }
   *       500: { description: Failed to assign the episode }
   */
  router.get('/api/videos/:youtubeId/episode', verifyToken, async (req, res) => {
    const { youtubeId } = req.params;
    if (!YOUTUBE_ID.test(youtubeId)) return res.status(400).json({ error: 'Invalid video id' });
    try {
      return res.json(await titleShowService.getVideoEpisode(youtubeId));
    } catch (error) {
      return sendError(res, error, 'Failed to load the episode', { youtubeId });
    }
  });

  router.put('/api/videos/:youtubeId/episode', verifyToken, async (req, res) => {
    const { youtubeId } = req.params;
    if (!YOUTUBE_ID.test(youtubeId)) return res.status(400).json({ error: 'Invalid video id' });
    if (!isObject(req.body)) return res.status(400).json({ error: 'The body must be an assignment' });
    try {
      return res.json(await titleShowService.assignEpisode(youtubeId, req.body));
    } catch (error) {
      return sendError(res, error, 'Failed to assign the episode', { youtubeId });
    }
  });

  return router;
}

module.exports = createTvTitleShowRoutes;
