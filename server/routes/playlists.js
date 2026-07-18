const express = require('express');
const { createOverrideSettingsValidator } = require('./overrideSettingsValidator');

function createPlaylistRoutes({ verifyToken, playlistModule, downloadModule, m3uGenerator, mediaServers, models, channelSettingsModule, ratingMapper, subfolderModule, playlistVideoFilters }) {
  const router = express.Router();
  const { Playlist, PlaylistVideo, Video } = models;

  // Keep the subfolder registry in sync when a playlist persists a real
  // default subfolder. register() ignores null/empty/sentinels and never throws.
  const registerSubfolder = (name) => {
    if (subfolderModule && name) {
      subfolderModule.register(name).catch(() => {});
    }
  };

  const VIDEO_SORT_DIRECTIONS = { asc: 'ASC', desc: 'DESC' };
  const DEFAULT_VIDEO_SORT_DIRECTION = 'ASC';
  const VIDEO_DOWNLOAD_STATES = new Set(['all', 'downloaded', 'not_downloaded']);
  const VIDEO_WATCHED_STATES = new Set(['all', 'watched', 'not_watched']);
  const VALID_SORT_ORDERS = new Set(['default', 'reversed']);

  const validateOverrideSettings = createOverrideSettingsValidator({
    channelSettingsModule,
    ratingMapper,
  });

  const logBgFailure = (req, playlistId, op) => (err) => {
    req.log.error({ err, playlist_id: playlistId }, `background ${op} failed`);
  };

  // Soft-deleted playlists (enabled: false) 404 on every id-addressed route.
  // Only POST /api/playlists (restore) and DELETE can touch one.
  const findEnabledPlaylist = (playlistId) =>
    Playlist.findOne({ where: { playlist_id: playlistId, enabled: true } });

  // A persisted default_sub_folder feeds the playlist download soft fallback,
  // which reaches the filesystem path. Validate it with the same traversal-safe
  // check used for channel subfolders. null/''/absent mean "no subfolder" (root).
  function defaultSubFolderInvalid(value) {
    if (value === undefined || value === null || value === '') return false;
    if (typeof value !== 'string') return true;
    return !channelSettingsModule.validateSubFolder(value).valid;
  }

  /**
   * @swagger
   * /api/playlists:
   *   get:
   *     summary: List subscribed playlists
   *     tags: [Playlists]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           default: 25
   *           maximum: 100
   *     responses:
   *       200:
   *         description: Paginated playlists
   *       500:
   *         description: Internal server error
   */
  router.get('/api/playlists', verifyToken, async (req, res) => {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const pageSize = Math.min(parseInt(req.query.pageSize || '25', 10), 100);
      const { count, rows } = await Playlist.findAndCountAll({
        where: { enabled: true },
        limit: pageSize,
        offset: (page - 1) * pageSize,
        order: [['updatedAt', 'DESC']],
      });
      res.json({ total: count, playlists: rows });
    } catch (err) {
      req.log.error({ err }, 'GET /api/playlists failed');
      res.status(500).json({ error: 'Failed to list playlists' });
    }
  });

  /**
   * @swagger
   * /api/playlists/{playlistId}:
   *   get:
   *     summary: Get a playlist with download and sync counts
   *     description: Includes not_downloaded_count and unsyncable_count alongside the playlist row.
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube playlist ID
   *     responses:
   *       200:
   *         description: Playlist detail
   *       404:
   *         description: Playlist not found
   *       500:
   *         description: Internal server error
   */
  router.get('/api/playlists/:playlistId', verifyToken, async (req, res) => {
    try {
      const p = await findEnabledPlaylist(req.params.playlistId);
      if (!p) return res.status(404).json({ error: 'Playlist not found' });

      // Mirrors the "download new" selection in downloadModule.doPlaylistDownloads:
      // non-ignored playlist videos with no matching Video row yet.
      const candidates = await PlaylistVideo.findAll({
        where: { playlist_id: req.params.playlistId, ignored: false },
        attributes: ['youtube_id'],
      });
      const candidateIds = candidates.map((c) => c.youtube_id).filter(Boolean);
      let downloadedExisting = 0;
      // Downloads lacking the file type the playlist syncs as (its Download
      // Type setting: mp3 for MP3 Only playlists, video otherwise). Media
      // server sync leaves these out; the count feeds the UI notice.
      let unsyncable_count = 0;
      if (candidateIds.length > 0 && Video) {
        const existing = await Video.findAll({
          where: { youtubeId: candidateIds },
          attributes: ['youtubeId', 'filePath', 'audioFilePath'],
        });
        const existingIds = new Set(existing.map((v) => v.youtubeId));
        downloadedExisting = candidateIds.filter((id) => existingIds.has(id)).length;
        const targetsAudio = p.audio_format === 'mp3_only';
        unsyncable_count = existing.filter((v) => {
          const matching = targetsAudio ? v.audioFilePath : v.filePath;
          return !matching && (v.filePath || v.audioFilePath);
        }).length;
      }
      const not_downloaded_count = candidateIds.length - downloadedExisting;

      res.json({ playlist: p, not_downloaded_count, unsyncable_count });
    } catch (err) {
      req.log.error({ err }, 'GET /api/playlists/:playlistId failed');
      res.status(500).json({ error: 'Failed to fetch playlist' });
    }
  });

  /**
   * @swagger
   * /api/playlists/addplaylistinfo:
   *   post:
   *     summary: Fetch YouTube playlist info for a URL
   *     tags: [Playlists]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [url]
   *             properties:
   *               url:
   *                 type: string
   *                 description: YouTube playlist URL
   *     responses:
   *       200:
   *         description: Playlist info
   *       400:
   *         description: url is required
   *       403:
   *         description: Playlist requires authentication (cookies)
   *       404:
   *         description: Playlist not found
   *       503:
   *         description: Unable to reach YouTube
   *       500:
   *         description: Internal server error
   */
  router.post('/api/playlists/addplaylistinfo', verifyToken, async (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url is required' });
    try {
      const info = await playlistModule.getPlaylistInfo(url);
      res.json(info);
    } catch (err) {
      if (err.message === 'PLAYLIST_NOT_FOUND') return res.status(404).json({ error: 'Playlist not found' });
      if (err.message === 'COOKIES_REQUIRED') return res.status(403).json({ error: 'This playlist requires authentication (cookies)' });
      if (err.message === 'NETWORK_ERROR') return res.status(503).json({ error: 'Unable to reach YouTube' });
      req.log.error({ err }, 'addplaylistinfo failed');
      res.status(500).json({ error: 'Failed to fetch playlist info' });
    }
  });

  /**
   * @swagger
   * /api/playlists:
   *   post:
   *     summary: Subscribe to a playlist, restoring a soft-deleted one if present
   *     description: Fetches the playlist's videos and kicks off media server sync and M3U generation in the background. A restored playlist keeps its saved settings.
   *     tags: [Playlists]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [url]
   *             properties:
   *               url:
   *                 type: string
   *                 description: YouTube playlist URL
   *               settings:
   *                 type: object
   *                 description: Optional per-playlist download settings
   *     responses:
   *       201:
   *         description: Playlist subscribed
   *       400:
   *         description: Missing url or invalid default_sub_folder
   *       500:
   *         description: Internal server error
   */
  router.post('/api/playlists', verifyToken, async (req, res) => {
    const { url, settings = {} } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    if (defaultSubFolderInvalid(settings.default_sub_folder)) {
      return res.status(400).json({ error: 'Invalid default_sub_folder' });
    }
    try {
      const info = await playlistModule.getPlaylistInfo(url);
      const { playlist: created, restored } = await playlistModule.upsertPlaylist(info, { enabled: true, settings });
      // On restore the submitted settings are discarded in favor of the saved
      // ones, so the submitted subfolder must not enter the registry.
      if (!restored) registerSubfolder(settings.default_sub_folder);
      await playlistModule.fetchAllPlaylistVideos(created.playlist_id);
      mediaServers.mediaServerSync.syncPlaylist(created.id).catch(logBgFailure(req, created.playlist_id, 'playlist sync'));
      m3uGenerator.generatePlaylistM3U(created.id).catch(logBgFailure(req, created.playlist_id, 'M3U generation'));
      res.status(201).json({ playlist: created, restored });
    } catch (err) {
      req.log.error({ err }, 'subscribe failed');
      res.status(500).json({ error: 'Failed to subscribe to playlist' });
    }
  });

  /**
   * @swagger
   * /api/playlists/{playlistId}:
   *   delete:
   *     summary: Unsubscribe from a playlist (soft delete)
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube playlist ID
   *     responses:
   *       200:
   *         description: Playlist disabled
   *       404:
   *         description: Playlist not found
   *       500:
   *         description: Internal server error
   */
  router.delete('/api/playlists/:playlistId', verifyToken, async (req, res) => {
    try {
      const p = await Playlist.findOne({ where: { playlist_id: req.params.playlistId } });
      if (!p) return res.status(404).json({ error: 'Playlist not found' });
      await p.update({ enabled: false });
      res.json({ success: true });
    } catch (err) {
      req.log.error({ err }, 'unsubscribe failed');
      res.status(500).json({ error: 'Failed to unsubscribe' });
    }
  });

  /**
   * @swagger
   * /api/playlists/{playlistId}:
   *   patch:
   *     summary: Update playlist flags
   *     description: Accepts enabled, auto_download, sync_to_plex, sync_to_jellyfin, sync_to_emby, and public_on_servers; other fields are ignored.
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube playlist ID
   *     responses:
   *       200:
   *         description: Updated playlist
   *       404:
   *         description: Playlist not found
   *       500:
   *         description: Internal server error
   */
  router.patch('/api/playlists/:playlistId', verifyToken, async (req, res) => {
    const allowed = ['enabled', 'auto_download', 'sync_to_plex', 'sync_to_jellyfin', 'sync_to_emby', 'public_on_servers'];
    const updates = {};
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
    try {
      const p = await findEnabledPlaylist(req.params.playlistId);
      if (!p) return res.status(404).json({ error: 'Playlist not found' });
      await p.update(updates);
      res.json({ playlist: p });
    } catch (err) {
      req.log.error({ err }, 'patch playlist failed');
      res.status(500).json({ error: 'Failed to update playlist' });
    }
  });

  /**
   * @swagger
   * /api/playlists/{playlistId}/settings:
   *   get:
   *     summary: Get per-playlist download settings
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube playlist ID
   *     responses:
   *       200:
   *         description: Playlist settings
   *       404:
   *         description: Playlist not found
   *       500:
   *         description: Internal server error
   */
  router.get('/api/playlists/:playlistId/settings', verifyToken, async (req, res) => {
    try {
      const p = await findEnabledPlaylist(req.params.playlistId);
      if (!p) return res.status(404).json({ error: 'Playlist not found' });
      res.json({
        default_sub_folder: p.default_sub_folder,
        video_quality: p.video_quality,
        min_duration: p.min_duration,
        max_duration: p.max_duration,
        title_filter_regex: p.title_filter_regex,
        audio_format: p.audio_format,
        default_rating: p.default_rating,
        sort_order: p.sort_order,
      });
    } catch (err) {
      req.log.error({ err }, 'get settings failed');
      res.status(500).json({ error: 'Failed to get settings' });
    }
  });

  /**
   * @swagger
   * /api/playlists/{playlistId}/settings:
   *   put:
   *     summary: Update per-playlist download settings
   *     description: Accepts default_sub_folder, video_quality, min_duration, max_duration, title_filter_regex, audio_format, default_rating, and sort_order.
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube playlist ID
   *     responses:
   *       200:
   *         description: Applied settings
   *       400:
   *         description: Invalid default_sub_folder or sort_order
   *       404:
   *         description: Playlist not found
   *       500:
   *         description: Internal server error
   */
  router.put('/api/playlists/:playlistId/settings', verifyToken, async (req, res) => {
    const allowed = ['default_sub_folder', 'video_quality', 'min_duration', 'max_duration', 'title_filter_regex', 'audio_format', 'default_rating', 'sort_order'];
    const updates = {};
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
    if (defaultSubFolderInvalid(updates.default_sub_folder)) {
      return res.status(400).json({ error: 'Invalid default_sub_folder' });
    }
    if ('sort_order' in updates && !VALID_SORT_ORDERS.has(updates.sort_order)) {
      return res.status(400).json({ error: 'Invalid sort_order; expected default or reversed' });
    }
    try {
      const p = await findEnabledPlaylist(req.params.playlistId);
      if (!p) return res.status(404).json({ error: 'Playlist not found' });
      await p.update(updates);
      registerSubfolder(updates.default_sub_folder);
      res.json({ settings: updates });
    } catch (err) {
      req.log.error({ err }, 'update settings failed');
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  /**
   * @swagger
   * /api/playlists/{playlistId}/videos:
   *   get:
   *     summary: List playlist videos with download and watch overlay
   *     description: Each row overlays download state, file details, and watched_by (media server types with a played watch-status row for the video).
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube playlist ID
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           default: 50
   *           maximum: 200
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc, recent]
   *         description: Position order, or first-seen order for recent
   *       - in: query
   *         name: downloadState
   *         schema:
   *           type: string
   *           enum: [all, downloaded, not_downloaded]
   *       - in: query
   *         name: watchedState
   *         schema:
   *           type: string
   *           enum: [all, watched, not_watched]
   *         description: Filter on watched status (per the configured watched rule); not_watched includes videos with no watch data
   *     responses:
   *       200:
   *         description: Paginated playlist videos
   *       400:
   *         description: Invalid downloadState or watchedState
   *       404:
   *         description: Playlist not found
   *       500:
   *         description: Internal server error
   */
  router.get('/api/playlists/:playlistId/videos', verifyToken, async (req, res) => {
    try {
      const playlist = await findEnabledPlaylist(req.params.playlistId);
      if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

      const page = parseInt(req.query.page || '1', 10);
      const pageSize = Math.min(parseInt(req.query.pageSize || '50', 10), 200);
      const sortOrder = String(req.query.sortOrder || '').toLowerCase();
      const downloadState = String(req.query.downloadState || 'all').toLowerCase();
      if (!VIDEO_DOWNLOAD_STATES.has(downloadState)) {
        return res.status(400).json({ error: 'Invalid downloadState; expected all, downloaded, or not_downloaded' });
      }
      const watchedState = String(req.query.watchedState || 'all').toLowerCase();
      if (!VIDEO_WATCHED_STATES.has(watchedState)) {
        return res.status(400).json({ error: 'Invalid watchedState; expected all, watched, or not_watched' });
      }
      // 'recent' = first-seen order (what auto-download considers newest);
      // otherwise position in the owner's playlist order.
      const order = sortOrder === 'recent'
        ? [['added_at', 'DESC'], ['position', 'ASC']]
        : [['position', VIDEO_SORT_DIRECTIONS[sortOrder] || DEFAULT_VIDEO_SORT_DIRECTION]];

      // The list is paginated, so active filters must narrow the page query
      // itself.
      const idFilter = await playlistVideoFilters.resolveVideoIdFilter({
        playlistId: req.params.playlistId,
        downloadState,
        watchedState,
        PlaylistVideo,
        Video,
        watchStatusQueries: mediaServers.watchStatusQueries,
      });
      if (idFilter.empty) return res.json({ total: 0, videos: [] });

      const where = { playlist_id: req.params.playlistId };
      if (idFilter.youtubeIdWhere) {
        where.youtube_id = idFilter.youtubeIdWhere;
      }

      const { count, rows } = await PlaylistVideo.findAndCountAll({
        where,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        order,
      });

      const youtubeIds = rows.map((r) => r.youtube_id).filter(Boolean);
      const downloadedById = new Map();
      if (youtubeIds.length > 0 && Video) {
        const downloaded = await Video.findAll({
          where: { youtubeId: youtubeIds },
          attributes: ['id', 'youtubeId', 'youTubeVideoName', 'youTubeChannelName', 'duration', 'originalDate', 'removed', 'youtube_removed', 'filePath', 'fileSize', 'audioFilePath', 'audioFileSize'],
        });
        downloaded.forEach((v) => downloadedById.set(v.youtubeId, v));
      }

      const watchedByVideoId = await mediaServers.watchStatusQueries.getWatchedByMap(
        [...downloadedById.values()].map((v) => v.id)
      );

      const videos = rows.map((row) => {
        const dl = downloadedById.get(row.youtube_id);
        const youtubeId = row.youtube_id;
        const isDownloaded = !!(dl && !dl.removed && (dl.filePath || dl.audioFilePath));
        // Has a Videos row but no usable file: previously downloaded, then
        // deleted/lost. doPlaylistDownloads skips these unless allowRedownload is set.
        const previouslyDownloaded = !!dl && !isDownloaded;
        const youtubeRemoved = Boolean(dl?.youtube_removed);
        const localThumb = `/images/videothumb-${youtubeId}.jpg`;
        const flatThumb = row.thumbnail || `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
        return {
          id: row.id,
          playlist_id: row.playlist_id,
          youtube_id: youtubeId,
          position: row.position,
          added_at: row.added_at,
          channel_id: row.channel_id || null,
          ignored: row.ignored,
          ignored_at: row.ignored_at,
          title: row.title || dl?.youTubeVideoName || null,
          channel_name: row.channel_name || dl?.youTubeChannelName || null,
          duration: typeof row.duration === 'number'
            ? row.duration
            : typeof dl?.duration === 'number'
              ? dl.duration
              : null,
          published_at: row.published_at || dl?.originalDate || null,
          thumbnail: youtubeRemoved ? localThumb : flatThumb,
          downloaded: isDownloaded,
          previously_downloaded: previouslyDownloaded,
          youtube_removed: youtubeRemoved,
          video_id: dl?.id ?? null,
          file_path: dl?.filePath ?? null,
          file_size: dl?.fileSize != null ? Number(dl.fileSize) : null,
          audio_file_path: dl?.audioFilePath ?? null,
          audio_file_size: dl?.audioFileSize != null ? Number(dl.audioFileSize) : null,
          watched_by: dl ? watchedByVideoId.get(dl.id) || [] : [],
        };
      });

      res.json({ total: count, videos });
    } catch (err) {
      req.log.error({ err }, 'get videos failed');
      res.status(500).json({ error: 'Failed to list videos' });
    }
  });

  // Full refresh from YouTube (webpage path with an InnerTube fallback, up to
  // 5000 entries; can take a minute for very large playlists). Older cached
  // clients may still send { fetchAll: true } - the body is ignored.
  /**
   * @swagger
   * /api/playlists/{playlistId}/refresh:
   *   post:
   *     summary: Refresh playlist videos from YouTube
   *     description: Fetches the full playlist listing (can take a minute for very large playlists), then triggers media server sync and M3U regeneration in the background.
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube playlist ID
   *     responses:
   *       200:
   *         description: Number of videos fetched
   *       404:
   *         description: Playlist not found
   *       409:
   *         description: A fetch is already in progress for this playlist
   *       500:
   *         description: Internal server error
   */
  router.post('/api/playlists/:playlistId/refresh', verifyToken, async (req, res) => {
    try {
      const p = await findEnabledPlaylist(req.params.playlistId);
      if (!p) return res.status(404).json({ error: 'Playlist not found' });
      const count = await playlistModule.fetchAllPlaylistVideos(p.playlist_id);
      mediaServers.mediaServerSync.syncPlaylist(p.id).catch(logBgFailure(req, p.playlist_id, 'playlist sync'));
      m3uGenerator.generatePlaylistM3U(p.id).catch(logBgFailure(req, p.playlist_id, 'M3U generation'));
      res.json({ fetched: count });
    } catch (err) {
      if (err.message === 'FETCH_IN_PROGRESS') {
        return res.status(409).json({ error: 'A fetch is already in progress for this playlist' });
      }
      req.log.error({ err }, 'refresh failed');
      res.status(500).json({ error: 'Failed to refresh playlist' });
    }
  });

  /**
   * @swagger
   * /api/playlists/{playlistId}/sync:
   *   post:
   *     summary: Trigger media server playlist sync
   *     description: Runs in the background; the outcome lands in playlist_sync_state.
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube playlist ID
   *     responses:
   *       202:
   *         description: Sync accepted
   *       404:
   *         description: Playlist not found
   *       500:
   *         description: Internal server error
   */
  router.post('/api/playlists/:playlistId/sync', verifyToken, async (req, res) => {
    try {
      const p = await findEnabledPlaylist(req.params.playlistId);
      if (!p) return res.status(404).json({ error: 'Playlist not found' });
      // The sync polls media-server library scans with backoff and can take
      // minutes; run it in the background and report acceptance. The outcome
      // (last_synced_at / last_error) lands in playlist_sync_state.
      mediaServers.mediaServerSync.syncPlaylist(p.id).catch(logBgFailure(req, p.playlist_id, 'playlist sync'));
      res.status(202).json({ success: true });
    } catch (err) {
      req.log.error({ err }, 'sync failed');
      res.status(500).json({ error: 'Sync failed' });
    }
  });

  const MAX_SELECTED_DOWNLOAD_IDS = 1000;

  // Manually trigger download of all not-yet-downloaded videos for this playlist.
  // Fire-and-forget; downloads are long-running. Returns 202 immediately. The
  // post-download hook (in downloadModule) handles playlist sync + M3U regen.
  // Optionally accepts { videoIds: string[] } to download only specific videos.
  /**
   * @swagger
   * /api/playlists/{playlistId}/download:
   *   post:
   *     summary: Queue downloads for playlist videos
   *     description: Downloads all not-yet-downloaded videos, or only the ids in videoIds when provided. Fire-and-forget; the post-download hook handles playlist sync and M3U regeneration.
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube playlist ID
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               videoIds:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Specific YouTube video IDs to download (max 1000)
   *               overrideSettings:
   *                 type: object
   *                 description: One-off download setting overrides
   *     responses:
   *       202:
   *         description: Download started
   *       400:
   *         description: Invalid videoIds or overrideSettings
   *       404:
   *         description: Playlist not found
   *       500:
   *         description: Internal server error
   */
  router.post('/api/playlists/:playlistId/download', verifyToken, async (req, res) => {
    try {
      const videoIds = req.body?.videoIds;
      if (videoIds !== undefined) {
        const valid =
          Array.isArray(videoIds) &&
          videoIds.length > 0 &&
          videoIds.length <= MAX_SELECTED_DOWNLOAD_IDS &&
          videoIds.every((id) => typeof id === 'string' && id.length > 0);
        if (!valid) {
          return res.status(400).json({ error: 'videoIds must be an array of video ids' });
        }
      }

      const overrideResult = validateOverrideSettings(req.body?.overrideSettings);
      if (!overrideResult.ok) {
        return res.status(400).json({ error: 'Invalid overrideSettings' });
      }

      const p = await findEnabledPlaylist(req.params.playlistId);
      if (!p) return res.status(404).json({ error: 'Playlist not found' });

      const download = downloadModule.doPlaylistDownloads(p, {
        youtubeIds: videoIds,
        overrideSettings: overrideResult.value,
      });
      download.catch((err) => {
        req.log.error({ err, playlist_id: p.playlist_id }, 'doPlaylistDownloads failed');
      });
      res.status(202).json({ status: 'accepted', message: 'Playlist download started' });
    } catch (err) {
      req.log.error({ err }, 'trigger playlist download failed');
      res.status(500).json({ error: 'Failed to start playlist download' });
    }
  });

  /**
   * @swagger
   * /api/playlists/{playlistId}/regenerate-m3u:
   *   post:
   *     summary: Regenerate the playlist M3U file
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube playlist ID
   *     responses:
   *       200:
   *         description: Regeneration result
   *       404:
   *         description: Playlist not found
   *       500:
   *         description: Internal server error
   */
  router.post('/api/playlists/:playlistId/regenerate-m3u', verifyToken, async (req, res) => {
    try {
      const p = await findEnabledPlaylist(req.params.playlistId);
      if (!p) return res.status(404).json({ error: 'Playlist not found' });
      const ok = await m3uGenerator.generatePlaylistM3U(p.id);
      res.json({ success: ok });
    } catch (err) {
      req.log.error({ err }, 'm3u regen failed');
      res.status(500).json({ error: 'M3U regen failed' });
    }
  });

  /**
   * @swagger
   * /api/playlists/{playlistId}/videos/{ytId}/ignore:
   *   post:
   *     summary: Ignore a playlist video
   *     description: Ignored videos are skipped by auto and bulk downloads but remain individually downloadable.
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube playlist ID
   *       - in: path
   *         name: ytId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube video ID
   *     responses:
   *       200:
   *         description: Video ignored
   *       404:
   *         description: Playlist not found
   *       500:
   *         description: Internal server error
   */
  router.post('/api/playlists/:playlistId/videos/:ytId/ignore', verifyToken, async (req, res) => {
    try {
      const p = await findEnabledPlaylist(req.params.playlistId);
      if (!p) return res.status(404).json({ error: 'Playlist not found' });
      await PlaylistVideo.update(
        { ignored: true, ignored_at: new Date() },
        { where: { playlist_id: req.params.playlistId, youtube_id: req.params.ytId } }
      );
      res.json({ success: true });
    } catch (err) {
      req.log.error({ err }, 'ignore failed');
      res.status(500).json({ error: 'Ignore failed' });
    }
  });

  /**
   * @swagger
   * /api/playlists/{playlistId}/videos/{ytId}/unignore:
   *   post:
   *     summary: Un-ignore a playlist video
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube playlist ID
   *       - in: path
   *         name: ytId
   *         required: true
   *         schema:
   *           type: string
   *         description: YouTube video ID
   *     responses:
   *       200:
   *         description: Video no longer ignored
   *       404:
   *         description: Playlist not found
   *       500:
   *         description: Internal server error
   */
  router.post('/api/playlists/:playlistId/videos/:ytId/unignore', verifyToken, async (req, res) => {
    try {
      const p = await findEnabledPlaylist(req.params.playlistId);
      if (!p) return res.status(404).json({ error: 'Playlist not found' });
      await PlaylistVideo.update(
        { ignored: false, ignored_at: null },
        { where: { playlist_id: req.params.playlistId, youtube_id: req.params.ytId } }
      );
      res.json({ success: true });
    } catch (err) {
      req.log.error({ err }, 'unignore failed');
      res.status(500).json({ error: 'Unignore failed' });
    }
  });

  return router;
}

module.exports = createPlaylistRoutes;
