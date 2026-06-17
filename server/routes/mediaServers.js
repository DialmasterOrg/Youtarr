const express = require('express');

function createMediaServerRoutes({ verifyToken, configModule, mediaServers }) {
  const router = express.Router();
  const { JellyfinAdapter, EmbyAdapter } = mediaServers.adapters;

  router.get('/api/mediaservers/status', verifyToken, async (req, res) => {
    try {
      const cfg = configModule.getConfig();
      const enabled = mediaServers.serverRegistry.getEnabledAdapters(cfg);
      const out = { plex: false, jellyfin: false, emby: false };
      for (const a of enabled) {
        if (a.constructor.name === 'PlexAdapter') out.plex = true;
        if (a.constructor.name === 'JellyfinAdapter') out.jellyfin = true;
        if (a.constructor.name === 'EmbyAdapter') out.emby = true;
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
      reqLog.error({ err }, 'list users failed');
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

  return router;
}

module.exports = createMediaServerRoutes;
