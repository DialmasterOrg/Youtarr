const axios = require('axios');
const configModule = require('./configModule');
const logger = require('../logger');

class PlexModule {
  constructor() {}

  getBaseUrl(preferredIp, config, preferredPort, preferredUseHttps) {
    const resolvedConfig = config || configModule.getConfig();
    const managedUrl = (process.env.PLEX_URL || resolvedConfig.plexUrl || '').trim();

    if (managedUrl) {
      return managedUrl.replace(/\/+$/, '');
    }

    const ip = preferredIp || resolvedConfig.plexIP;
    if (!ip) {
      return null;
    }

    const rawPort =
      preferredPort !== undefined && preferredPort !== null && String(preferredPort).trim() !== ''
        ? String(preferredPort).trim()
        : resolvedConfig.plexPort ?? '32400';
    const numericPort = String(rawPort).replace(/[^0-9]/g, '');
    const port = numericPort || '32400';

    const useHttps = preferredUseHttps !== undefined ? preferredUseHttps : resolvedConfig.plexViaHttps;
    const protocol = useHttps ? 'https' : 'http';
    return `${protocol}://${ip}:${port}`;
  }

  /**
   * Get the Plex library ID that should be refreshed for a given resolved subfolder.
   * Falls back to the global plexYoutubeLibraryId when no specific mapping is found.
   * @param {string|null} subfolder - Resolved subfolder name (no __ prefix, null = root)
   * @returns {string} Library ID to refresh
   */
  getLibraryIdForSubfolder(subfolder) {
    const config = configModule.getConfig();
    const raw = config.plexSubfolderLibraryMappings;
    const mappings = Array.isArray(raw) ? raw : [];

    const normalizedSubfolder = subfolder || null;
    const match = mappings
      .filter((m) => m && typeof m === 'object')
      .find((m) => (m.subfolder || null) === normalizedSubfolder);
    return (match && match.libraryId) || config.plexYoutubeLibraryId || '';
  }

  /**
   * Refresh the Plex library associated with the given resolved subfolder.
   * Falls back to the global library when no specific mapping exists.
   * @param {string|null} subfolder - Resolved subfolder name (no __ prefix, null = root)
   * @returns {Promise<Object|null>}
   */
  async refreshLibraryForSubfolder(subfolder) {
    const libraryId = this.getLibraryIdForSubfolder(subfolder);
    return this.refreshLibrary(libraryId);
  }

  /**
   * Refresh all distinct Plex libraries mapped to the provided subfolders.
   * Deduplicates library IDs so each library is only refreshed once.
   * @param {Array<string|null>} subfolders - Array of resolved subfolder names
   * @returns {Promise<void>}
   */
  async refreshLibrariesForSubfolders(subfolders) {
    const libraryIds = new Set(subfolders.map((sf) => this.getLibraryIdForSubfolder(sf)));
    await Promise.all(
      [...libraryIds].map((libraryId) =>
        this.refreshLibrary(libraryId)
      )
    );
  }

  async refreshLibrary(libraryId) {
    const config = configModule.getConfig();
    const resolvedLibraryId = libraryId || config.plexYoutubeLibraryId;
    try {
      const baseUrl = this.getBaseUrl(config.plexIP, config, config.plexPort, config.plexViaHttps);

      if (!baseUrl || !resolvedLibraryId || !config.plexApiKey) {
        logger.warn('Skipping Plex refresh - missing server details or credentials');
        return null;
      }

      if (!/^\d+$/.test(String(resolvedLibraryId))) {
        logger.warn({ libraryId: resolvedLibraryId }, 'Skipping Plex refresh - invalid non-numeric library ID');
        return null;
      }

      logger.info({ libraryId: resolvedLibraryId }, 'Refreshing Plex library');
      const response = await axios.get(
        `${baseUrl}/library/sections/${encodeURIComponent(resolvedLibraryId)}/refresh?X-Plex-Token=${config.plexApiKey}`
      );
      logger.info({ libraryId: resolvedLibraryId }, 'Plex library refresh initiated successfully');
      return response;
    } catch (error) {
      logger.error({ err: error }, 'Failed to refresh Plex library');
      if (error.code === 'ECONNREFUSED') {
        logger.warn('Could not connect to Plex server - continuing without refresh');
      }
      // Return null or empty response to indicate failure, but don't throw
      return null;
    }
  }

  async getLibraries() {
    const config = configModule.getConfig();
    return this.getLibrariesWithParams(config.plexIP, config.plexApiKey, config.plexPort, config.plexViaHttps);
  }

  async getLibrariesWithParams(plexIP, plexApiKey, plexPort, plexViaHttps) {
    try {
      if (!plexApiKey) {
        logger.warn('Missing Plex API key');
        return [];
      }

      const config = configModule.getConfig();
      const baseUrl = this.getBaseUrl(plexIP, config, plexPort, plexViaHttps);

      if (!baseUrl) {
        logger.warn('Missing Plex server URL');
        return [];
      }

      logger.info(`Attempting to fetch Plex libraries via URL: ${baseUrl}`);

      const response = await axios.get(
        `${baseUrl}/library/sections?X-Plex-Token=${plexApiKey}`
      );

      const libraries = response.data.MediaContainer.Directory.map(
        (directory) => ({
          id: directory.key,
          title: directory.title,
          locations: directory.Location.map((location) => ({
            // map the Location array
            id: location.id,
            path: location.path,
          })),
        })
      );

      return libraries;
    } catch (error) {
      logger.error({ err: error }, 'Failed to get Plex libraries');
      if (error.code === 'ECONNREFUSED') {
        logger.warn('Could not connect to Plex server - returning empty library list');
      }
      // Return empty array instead of throwing to prevent frontend crashes
      return [];
    }
  }

  async getAuthUrl() {
    try {
      const response = await axios.post(
        'https://plex.tv/api/v2/pins',
        { strong: true },
        {
          headers: {
            'X-Plex-Product': 'Youtarr',
            'X-Plex-Client-Identifier': configModule.getConfig().uuid,
          },
        }
      );
      const { id, code } = response.data;
      const authUrl = `https://app.plex.tv/auth#?clientID=${
        configModule.getConfig().uuid
      }&code=${code}&context%5Bdevice%5D%5Bproduct%5D=Youtarr`;
      return { authUrl, pinId: id };
    } catch (error) {
      logger.error({ err: error }, 'Failed to generate Plex auth URL');
      throw error;
    }
  }

  /**
   *
   * Check the PIN against the Plex server
   * IF there is no token in your config, then SET it (for first time setup)
   * Otherwise, validate the token against your config
   *
   * @returns
   */
  async checkPin(pinId) {
    logger.debug({ pinId }, 'Checking Plex PIN');
    let authToken = '';
    try {
      const response = await axios.get(`https://plex.tv/api/v2/pins/${pinId}`, {
        headers: {
          'X-Plex-Client-Identifier': configModule.getConfig().uuid,
        },
      });
      authToken = response.data.authToken;
    } catch (error) {
      logger.error({ err: error, pinId }, 'Failed to check Plex PIN');
      if (error.response && error.response.data) {
        logger.error({ responseData: error.response.data }, 'Plex PIN check error response');
      }
    }

    const currentPlexApiKey = configModule.getConfig().plexApiKey;
    // If there is not currently a token in the config, SET it
    if (!currentPlexApiKey || currentPlexApiKey == '') {
      let currentConfig = configModule.getConfig();
      currentConfig.plexApiKey = authToken;
      configModule.updateConfig(currentConfig);
      return { authToken };
    }

    if (authToken) {
      // Verify authToken against your Plex server
      try {
        const config = configModule.getConfig();
        const baseUrl = this.getBaseUrl(config.plexIP, config, config.plexPort, config.plexViaHttps);

        if (!baseUrl) {
          throw new Error('Missing Plex server URL');
        }

        await axios.get(`${baseUrl}/identity`, {
          headers: {
            'X-Plex-Token': authToken,
          },
        });

        if (authToken !== currentPlexApiKey) {
          return { authToken: 'invalid' };
        }
        return { authToken };
      } catch (error) {
        logger.warn({ err: error }, 'Invalid authToken for this Plex server');
        // If the request fails, the authToken is not valid for your server
        throw new Error('Invalid authToken for this server');
      }
    } else {
      logger.debug('No authToken returned from Plex');
      return { authToken: null };
    }
  }
}

module.exports = new PlexModule();
