const axios = require('axios');
const configModule = require('./configModule');

class PlexModule {
  constructor() {
    this.config = configModule.getConfig(); // Get the initial configuration
    configModule.on('change', this.handleConfigChange.bind(this)); // Listen for configuration changes
  }

  handleConfigChange(newConfig) {
    this.config = newConfig; // Update the configuration
  }

  refreshLibrary() {
    console.log('Refreshing library in Plex');
    // Example GET http://[plexIP]:32400/library/sections/[plexYoutubeLibraryId]/refresh?X-Plex-Token=[plexApiKey]
    const response = axios.get(`http://${this.config.plexIP}:32400/library/sections/${this.config.plexYoutubeLibraryId}/refresh?X-Plex-Token=${this.config.plexApiKey}`);
    console.log(response);
  }

  async getAuthUrl() {
    try {
      const response = await axios.post('https://plex.tv/api/v2/pins',
        { strong: true },
        {
          headers: {
            'X-Plex-Product': 'YoutubePlexArr',
            'X-Plex-Client-Identifier': this.config.uuid,
          }
        }
      );
      const { id, code } = response.data;
      const authUrl = `https://app.plex.tv/auth#?clientID=${this.config.uuid}&code=${code}&context%5Bdevice%5D%5Bproduct%5D=YoutubePlexArr`;
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
          'X-Plex-Client-Identifier': this.config.uuid
        }
      });
      const { authToken } = response.data;
      if (authToken) {
        // Verify authToken against your Plex server
        try {
          await axios.get(`http://${this.config.plexIP}:32400/identity`, {
            headers: {
              'X-Plex-Token': authToken
            }
          });
          // If the request is successful, the authToken is valid for your server
          this.config.plexApiKey = authToken;
          configModule.updateConfig(this.config);
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
