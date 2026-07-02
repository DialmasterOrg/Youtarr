const express = require('express');

function createPlaylistRoutes({ verifyToken, playlistModule, downloadModule, m3uGenerator, mediaServers, models, channelSettingsModule, ratingMapper, subfolderModule }) {
  const router = express.Router();
  const { Playlist, PlaylistVideo, Video } = models;

  // Keep the subfolder registry in sync when a playlist persists a real
  // default subfolder. register() ignores null/empty/sentinels and never throws.
  const registerSubfolder = (name) => {
    if (subfolderModule && name) {
      subfolderModule.register(name).catch(() => {});
    }
  };

  const ALLOWED_RESOLUTIONS = ['360', '480', '720', '1080', '1440', '2160'];
  const ALLOWED_AUDIO_FORMATS = ['video_mp3', 'mp3_only'];
  const VIDEO_SORT_DIRECTIONS = { asc: 'ASC', desc: 'DESC' };
  const DEFAULT_VIDEO_SORT_DIRECTION = 'ASC';

  // Returns { ok: true, value } or { ok: false }. value is undefined when input
  // is absent. Unknown keys are ignored. Rating is validated and normalized here
  // via ratingMapper (NR/null -> null).
  function validateOverrideSettings(input) {
    if (input === undefined) return { ok: true, value: undefined };
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return { ok: false };
    const out = {};
    if ('resolution' in input) {
      if (!ALLOWED_RESOLUTIONS.includes(String(input.resolution))) return { ok: false };
      out.resolution = String(input.resolution);
    }
    if ('allowRedownload' in input) {
      if (typeof input.allowRedownload !== 'boolean') return { ok: false };
      out.allowRedownload = input.allowRedownload;
    }
    if ('skipVideoFolder' in input) {
      if (typeof input.skipVideoFolder !== 'boolean') return { ok: false };
      out.skipVideoFolder = input.skipVideoFolder;
    }
    if ('subfolder' in input) {
      if (input.subfolder !== null) {
        if (typeof input.subfolder !== 'string') return { ok: false };
        if (!channelSettingsModule.validateSubFolder(input.subfolder).valid) return { ok: false };
      }
      out.subfolder = input.subfolder;
    }
    if ('audioFormat' in input) {
      if (input.audioFormat !== null && !ALLOWED_AUDIO_FORMATS.includes(input.audioFormat)) return { ok: false };
      out.audioFormat = input.audioFormat;
    }
    if ('rating' in input) {
      const ratingResult = ratingMapper.validateRating(input.rating);
      if (!ratingResult.valid) return { ok: false };
      out.rating = ratingResult.value;
    }
    return { ok: true, value: out };
  }

  const logBgFailure = (req, playlistId, op) => (err) => {
    req.log.error({ err, playlist_id: playlistId }, `background ${op} failed`);
  };

  // A persisted default_sub_folder feeds the playlist download soft fallback,
  // which reaches the filesystem path. Validate it with the same traversal-safe
  // check used for channel subfolders. null/''/absent mean "no subfolder" (root).
  function defaultSubFolderInvalid(value) {
    if (value === undefined || value === null || value === '') return false;
    if (typeof value !== 'string') return true;
    return !channelSettingsModule.validateSubFolder(value).valid;
  }

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

  router.get('/api/playlists/:playlistId', verifyToken, async (req, res) => {
    try {
      const p = await Playlist.findOne({ where: { playlist_id: req.params.playlistId } });
      if (!p) return res.status(404).json({ error: 'Playlist not found' });

      // Mirrors the "download new" selection in downloadModule.doPlaylistDownloads:
      // non-ignored playlist videos with no matching Video row yet.
      const candidates = await PlaylistVideo.findAll({
        where: { playlist_id: req.params.playlistId, ignored: false },
        attributes: ['youtube_id'],
      });
      const candidateIds = candidates.map((c) => c.youtube_id).filter(Boolean);
      let downloadedExisting = 0;
      if (candidateIds.length > 0 && Video) {
        const existing = await Video.findAll({
          where: { youtubeId: candidateIds },
          attributes: ['youtubeId'],
        });
        const existingIds = new Set(existing.map((v) => v.youtubeId));
        downloadedExisting = candidateIds.filter((id) => existingIds.has(id)).length;
      }
      const not_downloaded_count = candidateIds.length - downloadedExisting;

      res.json({ playlist: p, not_downloaded_count });
    } catch (err) {
      req.log.error({ err }, 'GET /api/playlists/:playlistId failed');
      res.status(500).json({ error: 'Failed to fetch playlist' });
    }
  });

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

  router.post('/api/playlists', verifyToken, async (req, res) => {
    const { url, settings = {} } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    if (defaultSubFolderInvalid(settings.default_sub_folder)) {
      return res.status(400).json({ error: 'Invalid default_sub_folder' });
    }
    try {
      const info = await playlistModule.getPlaylistInfo(url);
      const created = await playlistModule.upsertPlaylist(info, { enabled: true, settings });
      registerSubfolder(settings.default_sub_folder);
      await playlistModule.fetchAllPlaylistVideos(created.playlist_id);
      mediaServers.mediaServerSync.syncPlaylist(created.id).catch(logBgFailure(req, created.playlist_id, 'playlist sync'));
      m3uGenerator.generatePlaylistM3U(created.id).catch(logBgFailure(req, created.playlist_id, 'M3U generation'));
      res.status(201).json({ playlist: created });
    } catch (err) {
      req.log.error({ err }, 'subscribe failed');
      res.status(500).json({ error: 'Failed to subscribe to playlist' });
    }
  });

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

  router.patch('/api/playlists/:playlistId', verifyToken, async (req, res) => {
    const allowed = ['enabled', 'auto_download', 'sync_to_plex', 'sync_to_jellyfin', 'sync_to_emby', 'public_on_servers'];
    const updates = {};
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
    try {
      const p = await Playlist.findOne({ where: { playlist_id: req.params.playlistId } });
      if (!p) return res.status(404).json({ error: 'Playlist not found' });
      await p.update(updates);
      res.json({ playlist: p });
    } catch (err) {
      req.log.error({ err }, 'patch playlist failed');
      res.status(500).json({ error: 'Failed to update playlist' });
    }
  });

  router.get('/api/playlists/:playlistId/settings', verifyToken, async (req, res) => {
    try {
      const p = await Playlist.findOne({ where: { playlist_id: req.params.playlistId } });
      if (!p) return res.status(404).json({ error: 'Playlist not found' });
      res.json({
        default_sub_folder: p.default_sub_folder,
        video_quality: p.video_quality,
        min_duration: p.min_duration,
        max_duration: p.max_duration,
        title_filter_regex: p.title_filter_regex,
        audio_format: p.audio_format,
        default_rating: p.default_rating,
      });
    } catch (err) {
      req.log.error({ err }, 'get settings failed');
      res.status(500).json({ error: 'Failed to get settings' });
    }
  });

  router.put('/api/playlists/:playlistId/settings', verifyToken, async (req, res) => {
    const allowed = ['default_sub_folder', 'video_quality', 'min_duration', 'max_duration', 'title_filter_regex', 'audio_format', 'default_rating'];
    const updates = {};
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
    if (defaultSubFolderInvalid(updates.default_sub_folder)) {
      return res.status(400).json({ error: 'Invalid default_sub_folder' });
    }
    try {
      const p = await Playlist.findOne({ where: { playlist_id: req.params.playlistId } });
      if (!p) return res.status(404).json({ error: 'Playlist not found' });
      await p.update(updates);
      registerSubfolder(updates.default_sub_folder);
      res.json({ settings: updates });
    } catch (err) {
      req.log.error({ err }, 'update settings failed');
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  router.get('/api/playlists/:playlistId/videos', verifyToken, async (req, res) => {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const pageSize = Math.min(parseInt(req.query.pageSize || '50', 10), 200);
      const sortDirection =
        VIDEO_SORT_DIRECTIONS[String(req.query.sortOrder || '').toLowerCase()] ||
        DEFAULT_VIDEO_SORT_DIRECTION;
      const { count, rows } = await PlaylistVideo.findAndCountAll({
        where: { playlist_id: req.params.playlistId },
        limit: pageSize,
        offset: (page - 1) * pageSize,
        order: [['position', sortDirection]],
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
        };
      });

      res.json({ total: count, videos });
    } catch (err) {
      req.log.error({ err }, 'get videos failed');
      res.status(500).json({ error: 'Failed to list videos' });
    }
  });

  router.post('/api/playlists/:playlistId/refresh', verifyToken, async (req, res) => {
    try {
      const count = await playlistModule.fetchAllPlaylistVideos(req.params.playlistId);
      const p = await Playlist.findOne({ where: { playlist_id: req.params.playlistId } });
      if (p) {
        mediaServers.mediaServerSync.syncPlaylist(p.id).catch(logBgFailure(req, p.playlist_id, 'playlist sync'));
        m3uGenerator.generatePlaylistM3U(p.id).catch(logBgFailure(req, p.playlist_id, 'M3U generation'));
      }
      res.json({ fetched: count });
    } catch (err) {
      req.log.error({ err }, 'refresh failed');
      res.status(500).json({ error: 'Failed to refresh playlist' });
    }
  });

  router.post('/api/playlists/:playlistId/sync', verifyToken, async (req, res) => {
    try {
      const p = await Playlist.findOne({ where: { playlist_id: req.params.playlistId } });
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

      const p = await Playlist.findOne({ where: { playlist_id: req.params.playlistId } });
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

  router.post('/api/playlists/:playlistId/regenerate-m3u', verifyToken, async (req, res) => {
    try {
      const p = await Playlist.findOne({ where: { playlist_id: req.params.playlistId } });
      if (!p) return res.status(404).json({ error: 'Playlist not found' });
      const ok = await m3uGenerator.generatePlaylistM3U(p.id);
      res.json({ success: ok });
    } catch (err) {
      req.log.error({ err }, 'm3u regen failed');
      res.status(500).json({ error: 'M3U regen failed' });
    }
  });

  router.post('/api/playlists/:playlistId/videos/:ytId/ignore', verifyToken, async (req, res) => {
    try {
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

  router.post('/api/playlists/:playlistId/videos/:ytId/unignore', verifyToken, async (req, res) => {
    try {
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
