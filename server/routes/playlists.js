const express = require('express');
const { MAX_PLAYLIST_VIDEOS, MAX_SELECTED_DOWNLOAD_IDS, DEFAULT_PREVIEW_COUNT, FETCH_IN_PROGRESS_MESSAGE } = require('../modules/playlistConstants');
const { createOverrideSettingsValidator } = require('./overrideSettingsValidator');
const { createSubscribeSettingsValidator } = require('./playlistSubscribeSettings');

// Saved settings the Add Playlist dialog shows when a removed playlist is restored.
const RESTORE_PREVIEW_SETTING_KEYS = ['auto_download', 'default_sub_folder', 'video_quality', 'audio_format'];

function createPlaylistRoutes({ verifyToken, playlistModule, downloadModule, m3uGenerator, mediaServers, models, channelSettingsModule, ratingMapper, subfolderModule, playlistVideoFilters, playlistDownloadModule }) {
  const router = express.Router();
  const { Playlist, PlaylistVideo, Video } = models;
  const downloadDeps = { PlaylistVideo, Video, playlistModule, downloadModule };

  const respondToFollowingError = (res, err) => {
    const errors = {
      FETCH_IN_PROGRESS: [409, FETCH_IN_PROGRESS_MESSAGE],
      PLAYLIST_TOO_LARGE: [422, `Automatic following supports playlists with up to ${MAX_PLAYLIST_VIDEOS.toLocaleString('en-US')} entries. This playlist exceeds that limit.`],
      PLAYLIST_REFRESH_INCOMPLETE: [503, 'YouTube did not provide a verifiably complete playlist. Your starting point was not changed. Try refreshing again later.'],
    };
    const response = Object.hasOwn(errors, err.message) ? errors[err.message] : null;
    if (!response) return false;
    res.status(response[0]).json({ error: response[1] });
    return true;
  };

  // Keep the subfolder registry in sync when a playlist persists a real
  // default subfolder. register() ignores null/empty/sentinels and never throws.
  const registerSubfolder = (name) => {
    if (subfolderModule && name) {
      subfolderModule.register(name).catch(() => {});
    }
  };

  const VIDEO_DOWNLOAD_STATES = new Set(['all', 'downloaded', 'not_downloaded']);
  const VIDEO_WATCHED_STATES = new Set(['all', 'watched', 'not_watched']);
  const VALID_SORT_ORDERS = new Set(['default', 'reversed']);

  const validateOverrideSettings = createOverrideSettingsValidator({
    channelSettingsModule,
    ratingMapper,
  });
  const validateSubscribeSettings = createSubscribeSettingsValidator({
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
   *     description: Includes not_downloaded_count, unsyncable_count, following_existing_count (older eligible entries needing explicit selection), and following_requested_count (eligible saved selections not yet downloaded) alongside the playlist row.
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

      const counts = await playlistDownloadModule.getCounts(p, downloadDeps);
      res.json({ playlist: p, ...counts });
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
   *         description: Playlist info. existing_subscription is null for a playlist Youtarr has never saved; otherwise it reports whether the playlist is subscribed (enabled) and its saved auto_download, default_sub_folder, video_quality, and audio_format, which a restore keeps.
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
      const saved = await Playlist.findOne({ where: { playlist_id: info.playlist_id } });
      const existingSubscription = saved
        ? {
          enabled: Boolean(saved.enabled),
          settings: Object.fromEntries(RESTORE_PREVIEW_SETTING_KEYS.map((key) => [key, saved[key] ?? null])),
        }
        : null;
      res.json({ ...info, existing_subscription: existingSubscription });
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
   *     description: Saves the subscription, fetches its videos, and starts background sync/M3U generation. Restores saved settings. Expected following setup failures return 201 with a warning and turn auto-download off for size/completeness errors; a concurrent refresh keeps the current setting.
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
   *                 description: Optional per-playlist settings, applied only when the playlist is new. Accepts auto_download, sync_to_plex, sync_to_jellyfin, sync_to_emby, public_on_servers, default_sub_folder, video_quality, min_duration, max_duration, title_filter_regex, audio_format, default_rating, and sort_order; other keys are ignored.
   *     responses:
   *       201:
   *         description: Saved playlist, restored flag, and optional following setup warning
   *       400:
   *         description: Missing url or an invalid settings value
   *       500:
   *         description: Internal server error
   */
  router.post('/api/playlists', verifyToken, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    try {
      const validated = validateSubscribeSettings(req.body.settings);
      if (!validated.ok) return res.status(400).json({ error: validated.error });
      const settings = validated.value;
      const info = await playlistModule.getPlaylistInfo(url);
      const { playlist: created, restored } = await playlistModule.upsertPlaylist(info, { enabled: true, settings });
      // On restore the submitted settings are discarded in favor of the saved
      // ones, so the submitted subfolder must not enter the registry.
      if (!restored) registerSubfolder(settings.default_sub_folder);
      let warning;
      try {
        await playlistModule.refreshForFollowing(created, { followFromNow: !!created.auto_download });
      } catch (err) {
        if (err.message === 'FETCH_IN_PROGRESS') {
          warning = 'Playlist saved. A refresh is already in progress; check the video listing and following status when it finishes.';
        } else if (playlistModule.isFollowingSetupError(err)) {
          warning = await playlistModule.recoverFollowingSetup(created, err, { disableAutoDownload: true });
        } else {
          throw err;
        }
      }
      mediaServers.mediaServerSync.syncPlaylist(created.id).catch(logBgFailure(req, created.playlist_id, 'playlist sync'));
      m3uGenerator.generatePlaylistM3U(created.id).catch(logBgFailure(req, created.playlist_id, 'M3U generation'));
      res.status(201).json({ playlist: created, restored, ...(warning && { warning }) });
    } catch (err) {
      if (respondToFollowingError(res, err)) return;
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
   *     description: Accepts enabled, auto_download, sync_to_plex, sync_to_jellyfin, sync_to_emby, and public_on_servers; other fields are ignored. First enabling auto_download refreshes the full playlist and saves a starting point before enabling downloads; resuming with a saved starting point or disabling does not refresh.
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
   *       400:
   *         description: auto_download must be a boolean
   *       404:
   *         description: Playlist not found
   *       409:
   *         description: A playlist refresh is already in progress
   *       422:
   *         description: Playlist exceeds the 5000-entry automatic following limit
   *       503:
   *         description: A complete playlist snapshot could not be verified
   *       500:
   *         description: Internal server error
   */
  router.patch('/api/playlists/:playlistId', verifyToken, async (req, res) => {
    const allowed = ['enabled', 'auto_download', 'sync_to_plex', 'sync_to_jellyfin', 'sync_to_emby', 'public_on_servers'];
    const updates = {};
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
    if ('auto_download' in updates && typeof updates.auto_download !== 'boolean') {
      return res.status(400).json({ error: 'auto_download must be a boolean' });
    }
    try {
      const p = await findEnabledPlaylist(req.params.playlistId);
      if (!p) return res.status(404).json({ error: 'Playlist not found' });
      if (updates.auto_download && !p.auto_download_baseline_at) {
        await playlistModule.refreshForFollowing(p);
      }
      await p.update(updates);
      res.json({ playlist: p });
    } catch (err) {
      if (respondToFollowingError(res, err)) return;
      req.log.error({ err, playlist_id: req.params.playlistId }, 'patch playlist failed');
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
   *           enum: [asc, desc, recent, downloaded, published]
   *         description: Playlist position, discovery time, download time, or publication date; unknown dates sort last
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
      const order = playlistVideoFilters.getVideoOrder(sortOrder);

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
          attributes: ['id', 'youtubeId', 'youTubeVideoName', 'youTubeChannelName', 'duration', 'originalDate', 'removed', 'youtube_removed', 'filePath', 'fileSize', 'audioFilePath', 'audioFileSize', 'video_resolution'],
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
          // Deprecated response alias; retain for older API consumers.
          added_at: row.first_seen_at || null,
          first_seen_at: row.first_seen_at || null,
          downloaded_at: row.downloaded_at || null,
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
          video_resolution: dl?.video_resolution ?? null,
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
        return res.status(409).json({ error: FETCH_IN_PROGRESS_MESSAGE });
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

  const validBatchIds = (ids) => Array.isArray(ids) && ids.length <= MAX_SELECTED_DOWNLOAD_IDS &&
    ids.every((id) => typeof id === 'string' && id.length > 0);

  // Preview all tracked eligible entries, never just the page visible in the UI.
  /**
   * @swagger
   * /api/playlists/{playlistId}/download-preview:
   *   get:
   *     summary: Preview an explicit batch of existing playlist videos
   *     description: Returns all eligible tracked candidates, selectedIds, and missingDates. Publication ordering selects nothing when any eligible date is unknown. Does not refresh or queue downloads.
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema: { type: string }
   *       - in: query
   *         name: order
   *         schema: { type: string, enum: [published, asc, desc], default: published }
   *       - in: query
   *         name: count
   *         schema: { type: integer, minimum: 1, maximum: 1000, default: 5 }
   *     responses:
   *       200:
   *         description: Eligible candidates and suggested selection
   *       400:
   *         description: Invalid order or count
   *       404:
   *         description: Playlist not found
   *       500:
   *         description: Preview failed
   */
  router.get('/api/playlists/:playlistId/download-preview', verifyToken, async (req, res) => {
    const order = req.query.order || 'published';
    const count = Number(req.query.count || DEFAULT_PREVIEW_COUNT);
    if (!['asc', 'desc', 'published'].includes(order) || !Number.isInteger(count) || count < 1 || count > MAX_SELECTED_DOWNLOAD_IDS) {
      return res.status(400).json({ error: `Choose a valid order and a count between 1 and ${MAX_SELECTED_DOWNLOAD_IDS}` });
    }
    try {
      const p = await findEnabledPlaylist(req.params.playlistId);
      if (!p) return res.status(404).json({ error: 'Playlist not found' });
      res.json(await playlistDownloadModule.getPreview(p.playlist_id, { order, count }, downloadDeps));
    } catch (err) {
      req.log.error({ err }, 'preview playlist downloads failed');
      res.status(500).json({ error: 'Failed to preview playlist downloads' });
    }
  });

  /**
   * @swagger
   * /api/playlists/{playlistId}/following:
   *   post:
   *     summary: Start or resume following new playlist entries
   *     description: First setup refreshes before saving the starting point. Resuming preserves it. An explicit restart skips the current backlog and saved batch requests and preserves whether downloads are paused; queued jobs and files are kept.
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               restart:
   *                 type: boolean
   *                 default: false
   *               videoIds:
   *                 type: array
   *                 maxItems: 1000
   *                 items: { type: string }
   *                 description: Existing videos to queue and retry automatically; cannot be combined with restart
   *     responses:
   *       200:
   *         description: Playlist, queued count, and optional queue failure warning
   *       400:
   *         description: Invalid following options
   *       404:
   *         description: Playlist not found
   *       409:
   *         description: A playlist refresh is already in progress
   *       422:
   *         description: Playlist exceeds the 5000-entry automatic following limit
   *       503:
   *         description: A complete playlist snapshot could not be verified
   *       500:
   *         description: Following setup failed
   */
  router.post('/api/playlists/:playlistId/following', verifyToken, async (req, res) => {
    const { restart = false, videoIds = [] } = req.body || {};
    if (typeof restart !== 'boolean' || !validBatchIds(videoIds) || (restart && videoIds.length)) {
      return res.status(400).json({ error: 'Invalid following options' });
    }
    try {
      const p = await findEnabledPlaylist(req.params.playlistId);
      if (!p) return res.status(404).json({ error: 'Playlist not found' });
      if (restart || !p.auto_download_baseline_at) {
        await playlistModule.refreshForFollowing(p, { resetFollowing: restart });
      }
      // Resetting the starting point preserves the current running/paused state.
      // First setup and explicit resume enable downloads.
      if (!restart) await p.update({ auto_download: true });
      const result = videoIds.length ? await playlistDownloadModule.queueBatch(p, videoIds, { ...downloadDeps, logger: req.log }) : { queued: 0 };
      res.json({ playlist: p, ...result });
    } catch (err) {
      if (respondToFollowingError(res, err)) return;
      req.log.error({ err, playlist_id: req.params.playlistId }, 'configure playlist following failed');
      res.status(500).json({ error: 'Could not finish following setup. Please retry.' });
    }
  });

  /**
   * @swagger
   * /api/playlists/{playlistId}/download-batch:
   *   post:
   *     summary: Queue selected eligible existing videos without resetting following
   *     description: Applies saved download settings. Previously downloaded, unavailable, and ignored videos are excluded. When auto-download is enabled and a starting point exists, requests are saved for retry until downloaded or the starting point is reset. The original selection is queued in full. Scheduled runs allow up to the configured limit of discoveries plus the same number of older saved retries, rotating least-recently-attempted requests first. Requested discoveries use only the discovery allowance. Retry jobs are labelled separately; active downloads are excluded before selection.
   *     tags: [Playlists]
   *     parameters:
   *       - in: path
   *         name: playlistId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [videoIds]
   *             properties:
   *               videoIds:
   *                 type: array
   *                 minItems: 1
   *                 maxItems: 1000
   *                 items: { type: string }
   *     responses:
   *       202:
   *         description: Queued count and optional queue failure warning
   *       400:
   *         description: Invalid video IDs
   *       404:
   *         description: Playlist not found
   *       500:
   *         description: Queueing failed
   */
  router.post('/api/playlists/:playlistId/download-batch', verifyToken, async (req, res) => {
    const { videoIds } = req.body || {};
    if (!validBatchIds(videoIds) || !videoIds.length) {
      return res.status(400).json({ error: `Select between 1 and ${MAX_SELECTED_DOWNLOAD_IDS} videos` });
    }
    try {
      const p = await findEnabledPlaylist(req.params.playlistId);
      if (!p) return res.status(404).json({ error: 'Playlist not found' });
      res.status(202).json(await playlistDownloadModule.queueBatch(p, videoIds, { ...downloadDeps, logger: req.log }));
    } catch (err) {
      req.log.error({ err }, 'queue playlist batch failed');
      res.status(500).json({ error: 'Failed to queue selected videos; please retry' });
    }
  });

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

      const queued = await downloadModule.doPlaylistDownloads(p, {
        youtubeIds: videoIds,
        overrideSettings: overrideResult.value,
      });
      res.status(202).json({ status: 'accepted', message: queued ? 'Playlist download started' : 'No eligible videos to queue', queued });
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
