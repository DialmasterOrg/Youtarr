const logger = require('../../logger');
const configModule = require('../configModule');
const serverRegistry = require('./serverRegistry');

// Requires only serverRegistry, never the mediaServers index: downloadModule
// loads this file, and its tests cannot load the models index.

/**
 * Ask every connected media server to pick up the files a finished download
 * job added. Callers invoke this once per job, and only when the job
 * downloaded something. Never rejects: a refresh failure must not affect the
 * job, so it is logged as a warning instead.
 */
async function refreshAfterDownload() {
  let adapters;
  try {
    adapters = serverRegistry.getEnabledAdapters(configModule.getConfig());
  } catch (err) {
    logger.warn({ err }, 'Could not resolve media servers for the post-download library refresh');
    return;
  }

  await Promise.all(adapters.map(async (adapter) => {
    try {
      await adapter.refreshAfterDownload();
    } catch (err) {
      logger.warn({ err, serverType: adapter.serverType }, 'Post-download library refresh failed');
    }
  }));
}

module.exports = { refreshAfterDownload };
