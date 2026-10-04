const express = require('express');
const logger = require('../logger');

const MAX_FOLDER_NAME_LENGTH = 100;
const LIBRARY_LAYOUTS = new Set(['videos', 'tv']);

/**
 * TV show routes: library folder layouts and per-channel TV layout.
 * @param {Object} deps
 * @param {Function} deps.verifyToken
 * @param {Object} deps.libraryFolders - tvShows/libraryFolders
 * @param {Object} deps.channelLayout - tvShows/channelLayout
 * @param {Object} deps.layoutGuards - tvShows/layoutGuards (refusal bodies)
 * @param {Object} deps.reorganize - modules/reorganize (a channel's reorganize state)
 * @param {Object} deps.channelSettingsModule
 * @param {Object} deps.jobModule - Its running job blocks layout switches
 * @param {Object} deps.models
 * @param {Object} deps.libraryCheck - mediaServers/libraryCheck
 * @returns {express.Router}
 */
function createTvShowRoutes({
  verifyToken, libraryFolders, channelLayout, layoutGuards, reorganize, channelSettingsModule, jobModule, models,
  libraryCheck,
}) {
  const router = express.Router();
  const isDownloadRunning = () => Boolean(jobModule.getInProgressJobId());

  // Refusals carry .status (a change that moves files also names the change
  // to preview); anything else is unexpected.
  const sendError = (res, error, failure, context) => {
    if (error.status) {
      return res.status(error.status).json(layoutGuards.errorBody(error));
    }
    logger.error({ err: error, ...context }, failure);
    return res.status(500).json({ error: failure });
  };

  const findChannel = (channelId) => models.Channel.findOne({ where: { channel_id: channelId } });

  /**
   * @swagger
   * /api/library-folders:
   *   get:
   *     summary: List library folders with their layouts
   *     description: The main downloads folder (name "") and every subfolder, each with its layout (videos or tv), whether it is the default subfolder, whether it holds downloaded files, and how many enabled channels download to it.
   *     tags: [TV Shows]
   *     responses:
   *       200:
   *         description: Library folders
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 folders:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       name: { type: string, description: '"" for the main folder, else the subfolder name without __' }
   *                       layout: { type: string, enum: [videos, tv] }
   *                       isDefault: { type: boolean }
   *                       hasFiles: { type: boolean }
   *                       channels: { type: integer }
   *       500: { description: Failed to list library folders }
   */
  router.get('/api/library-folders', verifyToken, async (req, res) => {
    try {
      return res.json({ folders: await libraryFolders.listLibraryFolders() });
    } catch (error) {
      return sendError(res, error, 'Failed to list library folders');
    }
  });

  /**
   * @swagger
   * /api/library-folders:
   *   put:
   *     summary: Change a library folder's layout
   *     description: Sets the layout of the main folder (name "") or a subfolder. Every channel that downloads to the folder changes layout with it, so a folder holding downloaded videos is answered with a reorganizeRequired 409 (the change goes through the reorganize, which moves the files), a direct change is refused while a download runs, and TV is refused while a channel or playlist there downloads MP3. Switching the main folder to TV writes a .plexignore there that hides the __ subfolders from a Plex library pointed at it.
   *     tags: [TV Shows]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, layout]
   *             properties:
   *               name: { type: string }
   *               layout: { type: string, enum: [videos, tv] }
   *     responses:
   *       200: { description: The updated folder list and whether anything changed }
   *       400: { description: Invalid name or layout }
   *       404: { description: Unknown subfolder }
   *       409: { description: "The folder holds downloaded videos (reorganizeRequired, with the change to preview through /api/tv/reorganize/preview), a download or a reorganize is running, or its channels download MP3" }
   *       500: { description: Failed to change the folder layout }
   */
  router.put('/api/library-folders', verifyToken, async (req, res) => {
    const { name, layout } = req.body || {};
    if (typeof name !== 'string' || name.length > MAX_FOLDER_NAME_LENGTH) {
      return res.status(400).json({ error: 'name must be a folder name ("" for the main folder)' });
    }
    if (typeof layout !== 'string') {
      return res.status(400).json({ error: 'layout must be "videos" or "tv"' });
    }
    try {
      const { changed } = await libraryFolders.setFolderLayout(name, layout, { isDownloadRunning });
      return res.json({ changed, folders: await libraryFolders.listLibraryFolders() });
    } catch (error) {
      return sendError(res, error, 'Failed to change the folder layout', { name, layout });
    }
  });

  /**
   * @swagger
   * /api/library-folders/check:
   *   get:
   *     summary: Check the media server libraries that hold each library folder
   *     description: For each library folder and each configured media server (Plex, Jellyfin, Emby), the libraries that hold the folder and what works against Youtarr's files there - no library of the right kind, a library of the wrong type, the Plex Series agent or a legacy Plex agent, a Jellyfin/Emby library that saves NFO files or looks items up online, another library showing the same files again, or a library mounted at the folder under another name. Server paths differ from Youtarr's, so a folder is found by its __name and by matching a few files from each library to Youtarr's downloads. A TV subfolder held by exactly one Plex TV library also reports its Plex refresh mapping.
   *     tags: [TV Shows]
   *     parameters:
   *       - in: query
   *         name: folder
   *         required: false
   *         schema:
   *           type: array
   *           items: { type: string }
   *         description: Only report these folders ("" for the main folder); repeat for more than one
   *       - in: query
   *         name: layout
   *         required: false
   *         schema:
   *           type: string
   *           enum: [videos, tv]
   *         description: Check the folders given as this layout instead of their saved one (the reorganize preview checks the folders videos are about to move into as TV folders). Needs folder.
   *     responses:
   *       200:
   *         description: Per-server reachability and a report per folder
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 servers:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       serverType: { type: string, enum: [plex, jellyfin, emby] }
   *                       name: { type: string }
   *                       reachable: { type: boolean }
   *                       error: { type: string, nullable: true }
   *                 folders:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       name: { type: string }
   *                       layout: { type: string, enum: [videos, tv] }
   *                       hasFiles: { type: boolean }
   *                       channels: { type: integer }
   *                       servers:
   *                         type: array
   *                         items:
   *                           type: object
   *                           properties:
   *                             serverType: { type: string }
   *                             status: { type: string, enum: [ok, warning, missing, unreachable] }
   *                             libraries:
   *                               type: array
   *                               items:
   *                                 type: object
   *                                 properties:
   *                                   id: { type: string }
   *                                   name: { type: string }
   *                                   type: { type: string, enum: [videos, tv, mixed, music, other] }
   *                                   location: { type: string }
   *                                   relation: { type: string, enum: [exact, covers, inside] }
   *                             issues:
   *                               type: array
   *                               items:
   *                                 type: object
   *                                 properties:
   *                                   code: { type: string }
   *                                   message: { type: string }
   *                                   libraryId: { type: string }
   *                             plexMapping:
   *                               type: object
   *                               description: Plex only, TV subfolders only
   *                               properties:
   *                                 mappedLibraryId: { type: string, nullable: true }
   *                                 suggestedLibraryId: { type: string, nullable: true }
   *       400: { description: Invalid folder parameter }
   *       500: { description: Failed to check the media server libraries }
   */
  router.get('/api/library-folders/check', verifyToken, async (req, res) => {
    const raw = req.query.folder;
    const folders = raw === undefined ? null : [].concat(raw);
    if (folders && folders.some((name) => typeof name !== 'string' || name.length > MAX_FOLDER_NAME_LENGTH)) {
      return res.status(400).json({ error: 'folder must be a folder name ("" for the main folder)' });
    }
    const layout = req.query.layout;
    if (layout !== undefined && (!folders || !LIBRARY_LAYOUTS.has(layout))) {
      return res.status(400).json({ error: 'layout must be "videos" or "tv", for the folders given' });
    }
    try {
      return res.json(await libraryCheck.check(folders ? { folders, ...(layout ? { layout } : {}) } : {}));
    } catch (error) {
      return sendError(res, error, 'Failed to check the media server libraries');
    }
  });

  /**
   * @swagger
   * /api/library-folders/plex-mapping:
   *   put:
   *     summary: Map a TV folder to its Plex library for refreshes
   *     description: Adds a Plex subfolder library mapping so new episodes in a TV subfolder refresh the one Plex TV Shows library that holds it (as the library check reports it). An existing mapping for the folder is never replaced.
   *     tags: [TV Shows]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [folder, libraryId]
   *             properties:
   *               folder: { type: string, description: Subfolder name without __ }
   *               libraryId: { type: string }
   *     responses:
   *       200: { description: "The mapping, as { mappedLibraryId, plexSubfolderLibraryMappings } with the saved mappings" }
   *       400: { description: Invalid folder or library id, or the folder isn't a TV subfolder }
   *       409: { description: "Plex can't be reached, the folder already has another mapping, or that library isn't the one Plex TV library holding the folder" }
   *       500: { description: Failed to save the mapping }
   */
  router.put('/api/library-folders/plex-mapping', verifyToken, async (req, res) => {
    const { folder, libraryId } = req.body || {};
    if (typeof folder !== 'string' || !folder.trim() || folder.length > MAX_FOLDER_NAME_LENGTH) {
      return res.status(400).json({ error: 'folder must be a subfolder name' });
    }
    if (typeof libraryId !== 'string' || !/^\d+$/.test(libraryId)) {
      return res.status(400).json({ error: 'libraryId must be a Plex library id' });
    }
    try {
      return res.json(await libraryCheck.applyPlexMapping(folder.trim(), libraryId));
    } catch (error) {
      return sendError(res, error, 'Failed to save the Plex library mapping', { folder, libraryId });
    }
  });

  /**
   * @swagger
   * /api/channels/{channelId}/tv:
   *   get:
   *     summary: Get a channel's TV layout
   *     description: Whether the channel downloads to a TV folder, its show (name and folder) when it has one, the TV folders it can use, whether it has downloaded videos (switching then goes through the reorganize), and its reorganize state (running, and videos a reorganize could not move).
   *     tags: [TV Shows]
   *     parameters:
   *       - in: path
   *         name: channelId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: The channel's TV state }
   *       404: { description: Channel not found }
   *       500: { description: Failed to load the channel's TV state }
   */
  router.get('/api/channels/:channelId/tv', verifyToken, async (req, res) => {
    try {
      const channel = await findChannel(req.params.channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });
      const [tv, reorganizeState] = await Promise.all([
        channelLayout.getChannelTvState(channel),
        reorganize.channelState(channel.channel_id),
      ]);
      return res.json({ ...tv, reorganize: reorganizeState });
    } catch (error) {
      return sendError(res, error, 'Failed to load the channel\'s TV state', { channelId: req.params.channelId });
    }
  });

  /**
   * @swagger
   * /api/channels/{channelId}/tv/layout:
   *   put:
   *     summary: Switch a channel between Videos and TV
   *     description: Moves the channel to a folder with the requested layout. TV uses the given folder, else the default subfolder when it is a TV folder, else the only TV folder. Videos uses the given folder, else the folder the channel left for TV, else the default subfolder. A channel with downloaded videos is answered with a reorganizeRequired 409 naming the change to preview; refused while a download or a reorganize of the channel runs, and for TV while the channel downloads MP3.
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
   *             required: [layout]
   *             properties:
   *               layout: { type: string, enum: [videos, tv] }
   *               folder: { type: string, description: 'Library folder to use ("" for the main folder)' }
   *     responses:
   *       200: { description: The saved channel settings and the channel's TV state }
   *       400: { description: Invalid layout or folder, no TV folder, or a folder must be chosen }
   *       404: { description: Channel not found }
   *       409: { description: "The channel has downloaded videos (reorganizeRequired, with the change to preview), or a download or a reorganize of the channel is running" }
   *       500: { description: Failed to switch the channel's layout }
   */
  router.put('/api/channels/:channelId/tv/layout', verifyToken, async (req, res) => {
    const { channelId } = req.params;
    const { layout, folder } = req.body || {};
    if (typeof layout !== 'string') {
      return res.status(400).json({ error: 'layout must be "videos" or "tv"' });
    }
    if (folder !== undefined && folder !== null && (typeof folder !== 'string' || folder.length > MAX_FOLDER_NAME_LENGTH)) {
      return res.status(400).json({ error: 'folder must be a folder name ("" for the main folder)' });
    }
    try {
      const channel = await findChannel(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });
      const subFolder = await channelLayout.resolveLayoutTarget({ channel, layout, folder });
      const result = await channelSettingsModule.updateChannelSettings(
        channelId, { sub_folder: subFolder }, { isDownloadRunning }
      );
      const updated = await findChannel(channelId);
      const tv = await channelLayout.getChannelTvState(updated);
      return res.json({ settings: result.settings, tv: { ...tv, reorganize: await reorganize.channelState(channelId) } });
    } catch (error) {
      return sendError(res, error, 'Failed to switch the channel\'s layout', { channelId, layout });
    }
  });

  return router;
}

module.exports = createTvShowRoutes;
