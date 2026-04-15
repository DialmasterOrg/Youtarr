const PlexAdapter = require('./adapters/plexAdapter');
const JellyfinAdapter = require('./adapters/jellyfinAdapter');
const EmbyAdapter = require('./adapters/embyAdapter');
const plexModule = require('../plexModule');

class ServerRegistry {
  getEnabledAdapters(config) {
    const adapters = [];
    // Plex is "enabled" when an API key is configured AND a base URL can be resolved.
    // The URL may come from plexUrl, PLEX_URL env var, or be built from plexIP/plexPort/plexViaHttps
    // — plexModule.getBaseUrl encapsulates that precedence. Pass the resolved URL into the adapter
    // via a cloned config so the adapter doesn't need to repeat the resolution.
    const plexUrl = plexModule.getBaseUrl(null, config);
    if (plexUrl && config.plexApiKey) {
      adapters.push(new PlexAdapter({ ...config, plexUrl }));
    }
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
