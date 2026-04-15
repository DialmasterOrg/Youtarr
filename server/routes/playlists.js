const express = require('express');

function createPlaylistRoutes({ verifyToken, playlistModule, downloadModule, m3uGenerator, mediaServers, models }) {
  const router = express.Router();
  const { Playlist, PlaylistVideo } = models;

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
    try {
      const info = await playlistModule.getPlaylistInfo(url);
      const created = await playlistModule.upsertPlaylist(info, { enabled: true, settings });
      await playlistModule.fetchAllPlaylistVideos(created.playlist_id);
      mediaServers.mediaServerSync.syncPlaylist(created.id).catch(() => {});
      m3uGenerator.generatePlaylistM3U(created.id).catch(() => {});
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
    try {
      const p = await Playlist.findOne({ where: { playlist_id: req.params.playlistId } });
      if (!p) return res.status(404).json({ error: 'Playlist not found' });
      await p.update(updates);
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
      const { count, rows } = await PlaylistVideo.findAndCountAll({
        where: { playlist_id: req.params.playlistId },
        limit: pageSize,
        offset: (page - 1) * pageSize,
        order: [['position', 'ASC']],
      });
      res.json({ total: count, videos: rows });
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
        mediaServers.mediaServerSync.syncPlaylist(p.id).catch(() => {});
        m3uGenerator.generatePlaylistM3U(p.id).catch(() => {});
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
      await mediaServers.mediaServerSync.syncPlaylist(p.id);
      res.json({ success: true });
    } catch (err) {
      req.log.error({ err }, 'sync failed');
      res.status(500).json({ error: 'Sync failed' });
    }
  });

  // Manually trigger download of all not-yet-downloaded videos for this playlist.
  // Fire-and-forget; downloads are long-running. Returns 202 immediately. The
  // post-download hook (in downloadModule) handles playlist sync + M3U regen.
  router.post('/api/playlists/:playlistId/download', verifyToken, async (req, res) => {
    try {
      const p = await Playlist.findOne({ where: { playlist_id: req.params.playlistId } });
      if (!p) return res.status(404).json({ error: 'Playlist not found' });
      downloadModule.doPlaylistDownloads(p).catch((err) => {
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
