const axios = require('axios');
const configModule = require('./configModule');

class PlexModule {
  constructor() {
  }

  refreshLibrary() {
    console.log('Refreshing library in Plex');
    // Example GET http://[plexIP]:32400/library/sections/[plexYoutubeLibraryId]/refresh?X-Plex-Token=[plexApiKey]
    const response = axios.get(`http://${configModule.getConfig().plexIP}:32400/library/sections/${configModule.getConfig().plexYoutubeLibraryId}/refresh?X-Plex-Token=${configModule.getConfig().plexApiKey}`);
    console.log(response);
  }

  async getLibraries() {
    try {
      const response = await axios.get(`http://${configModule.getConfig().plexIP}:32400/library/sections?X-Plex-Token=${configModule.getConfig().plexApiKey}`);


      const libraries = response.data.MediaContainer.Directory.map((directory) => ({
        id: directory.key,
        title: directory.title,
      }));

      return libraries;
    } catch (error) {
      console.log('Error getting libraries from Plex: ' + error.message);
      throw error;
    }
  }

  async getAuthUrl() {
    try {
      const response = await axios.post('https://plex.tv/api/v2/pins',
        { strong: true },
        {
          headers: {
            'X-Plex-Product': 'YoutubePlexArr',
            'X-Plex-Client-Identifier': configModule.getConfig().uuid,
          }
        }
      );
      const { id, code } = response.data;
      const authUrl = `https://app.plex.tv/auth#?clientID=${configModule.getConfig().uuid}&code=${code}&context%5Bdevice%5D%5Bproduct%5D=YoutubePlexArr`;
      return { authUrl, pinId: id };
    } catch (error) {
      console.log('PIN ERROR!!' + error.message);
      throw error;
    }
  }

  async checkPin(pinId) {
    try {
      const response = await axios.get(`https://plex.tv/api/v2/pins/${pinId}`, {
        headers: {
          'X-Plex-Client-Identifier': configModule.getConfig().uuid
        }
      });
      const { authToken } = response.data;
      if (authToken) {
        // Verify authToken against your Plex server
        try {
          await axios.get(`http://${configModule.getConfig().plexIP}:32400/identity`, {
            headers: {
              'X-Plex-Token': authToken
            }
          });
          // If the request is successful, the authToken is valid for your server
          let currentConfig = configModule.getConfig();

          currentConfig.plexApiKey = authToken;

          configModule.updateConfig(currentConfig);
          return { authToken };
        } catch (error) {
          // If the request fails, the authToken is not valid for your server
          throw new Error('Invalid authToken for this server');
        }
      } else {
        return { authToken: null };
      }
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new PlexModule();
