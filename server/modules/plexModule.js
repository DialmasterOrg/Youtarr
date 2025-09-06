const axios = require('axios');
const configModule = require('./configModule');

class PlexModule {
  constructor() {}

  async refreshLibrary() {
    console.log('Refreshing library in Plex');
    // Example GET http://[plexIP]:32400/library/sections/[plexYoutubeLibraryId]/refresh?X-Plex-Token=[plexApiKey]
    try {
      const response = await axios.get(
        `http://${configModule.getConfig().plexIP}:32400/library/sections/${
          configModule.getConfig().plexYoutubeLibraryId
        }/refresh?X-Plex-Token=${configModule.getConfig().plexApiKey}`
      );
      console.log('Plex library refresh initiated successfully');
      return response;
    } catch (error) {
      console.log('Error refreshing library in Plex: ' + error.message);
      if (error.code === 'ECONNREFUSED') {
        console.log('Could not connect to Plex server - continuing without refresh');
      }
      // Return null or empty response to indicate failure, but don't throw
      return null;
    }
  }

  async getLibraries() {
    try {
      const response = await axios.get(
        `http://${
          configModule.getConfig().plexIP
        }:32400/library/sections?X-Plex-Token=${
          configModule.getConfig().plexApiKey
        }`
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
      console.log('Error getting libraries from Plex: ' + error.message);
      if (error.code === 'ECONNREFUSED') {
        console.log('Could not connect to Plex server - returning empty library list');
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
      console.log('PIN ERROR!!' + error.message);
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
    console.log('Checking pin: ' + pinId);
    let authToken = '';
    try {
      const response = await axios.get(`https://plex.tv/api/v2/pins/${pinId}`, {
        headers: {
          'X-Plex-Client-Identifier': configModule.getConfig().uuid,
        },
      });
      authToken = response.data.authToken;
    } catch (error) {
      console.log('PIN ERROR!!' + error.message);
      console.log(error.response.data);
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
        await axios.get(
          `http://${configModule.getConfig().plexIP}:32400/identity`,
          {
            headers: {
              'X-Plex-Token': authToken,
            },
          }
        );

        if (authToken !== currentPlexApiKey) {
          return { authToken: 'invalid' };
        }
        return { authToken };
      } catch (error) {
        console.log('Invalid authToken for this server: ' + error.message);
        // If the request fails, the authToken is not valid for your server
        throw new Error('Invalid authToken for this server');
      }
    } else {
      console.log('No authToken for this server: ' + authToken);
      return { authToken: null };
    }
  }
}

module.exports = new PlexModule();
