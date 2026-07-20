const express = require('express');

function createMediaServerRoutes({ verifyToken, configModule, mediaServers }) {
  const router = express.Router();
  const { JellyfinAdapter, EmbyAdapter, BaseAdapter } = mediaServers.adapters;
  const { describeHttpError } = BaseAdapter;

  router.get('/api/mediaservers/status', verifyToken, async (req, res) => {
    try {
      const cfg = configModule.getConfig();
      const enabled = mediaServers.serverRegistry.getEnabledAdapters(cfg);
      const out = { plex: false, jellyfin: false, emby: false };
      for (const a of enabled) {
        if (a.serverType in out) out[a.serverType] = true;
      }
      res.json(out);
    } catch (err) {
      req.log.error({ err }, 'media server status failed');
      res.status(500).json({ error: 'Failed to get media server status' });
    }
  });

  async function testAndRespond(AdapterClass, body, res, reqLog) {
    try {
      const adapter = new AdapterClass(body);
      const result = await adapter.testConnection();
      if (!result.ok) return res.status(502).json({ error: result.error || 'Connection failed' });
      res.json(result);
    } catch (err) {
      reqLog.error({ err }, 'test connection failed');
      res.status(500).json({ error: 'Test connection failed' });
    }
  }

  async function usersAndRespond(AdapterClass, body, res, reqLog) {
    try {
      const adapter = new AdapterClass(body);
      const users = await adapter.listUsers();
      res.json({ users });
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        return res.status(502).json({
          error: 'The server rejected the API key, so users could not be listed. Re-copy the key from the server dashboard (select only the key itself) and try again.',
        });
      }
      reqLog.error(describeHttpError(err), 'list users failed');
      if (err.isAxiosError) {
        return res.status(502).json({ error: `Could not reach the server: ${err.message}` });
      }
      res.status(500).json({ error: 'Failed to list users' });
    }
  }

  router.post('/api/mediaservers/jellyfin/test', verifyToken, (req, res) =>
    testAndRespond(JellyfinAdapter, req.body, res, req.log));
  router.post('/api/mediaservers/jellyfin/users', verifyToken, (req, res) =>
    usersAndRespond(JellyfinAdapter, req.body, res, req.log));
  router.post('/api/mediaservers/emby/test', verifyToken, (req, res) =>
    testAndRespond(EmbyAdapter, req.body, res, req.log));
  router.post('/api/mediaservers/emby/users', verifyToken, (req, res) =>
    usersAndRespond(EmbyAdapter, req.body, res, req.log));

  /**
   * @swagger
   * /api/mediaservers/watch-status:
   *   get:
   *     summary: Get watch status sync state
   *     tags: [Media Servers]
   *     responses:
   *       200:
   *         description: Whether a sync is running and the last run's summary
   */
  router.get('/api/mediaservers/watch-status', verifyToken, (req, res) => {
    res.json(mediaServers.watchStatusSync.getStatus());
  });

  /**
   * @swagger
   * /api/mediaservers/watch-status/sync:
   *   post:
   *     summary: Trigger a watch status sync now
   *     tags: [Media Servers]
   *     responses:
   *       202:
   *         description: Sync started
   *       409:
   *         description: A sync is already running
   */
  router.post('/api/mediaservers/watch-status/sync', verifyToken, (req, res) => {
    if (mediaServers.watchStatusSync.getStatus().running) {
      return res.status(409).json({ error: 'Watch status sync is already running' });
    }
    // Fire-and-forget: syncAll never rejects for per-server failures; this
    // catch covers unexpected rejections so no unhandled rejection escapes.
    mediaServers.watchStatusSync.syncAll('manual').catch((err) => {
      req.log.error({ err }, 'Manual watch status sync failed');
    });
    res.status(202).json({ started: true });
  });

  return router;
}

module.exports = createMediaServerRoutes;
