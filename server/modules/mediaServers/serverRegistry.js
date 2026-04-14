const PlexAdapter = require('./adapters/plexAdapter');
const JellyfinAdapter = require('./adapters/jellyfinAdapter');
const EmbyAdapter = require('./adapters/embyAdapter');

class ServerRegistry {
  getEnabledAdapters(config) {
    const adapters = [];
    if (config.plexUrl && config.plexApiKey) adapters.push(new PlexAdapter(config));
    if (config.jellyfinEnabled && config.jellyfinUrl && config.jellyfinApiKey && config.jellyfinUserId) {
      adapters.push(new JellyfinAdapter(config));
    }
    if (config.embyEnabled && config.embyUrl && config.embyApiKey && config.embyUserId) {
      adapters.push(new EmbyAdapter(config));
    }
    return adapters;
  }
}

module.exports = new ServerRegistry();
