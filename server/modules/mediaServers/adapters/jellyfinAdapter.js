const axios = require('axios');
const MediaBrowserAdapter = require('./mediaBrowserAdapter');
const { REQUEST_TIMEOUT_MS } = require('./baseAdapter');

class JellyfinAdapter extends MediaBrowserAdapter {
  constructor(config) {
    super(config, {
      serverType: 'jellyfin',
      url: config.jellyfinUrl,
      apiKey: config.jellyfinApiKey,
      userId: config.jellyfinUserId,
      allUsers: config.jellyfinWatchStatusAllUsers,
      videoLibraryIds: config.jellyfinVideoLibraryIds,
    });
  }

  // Jellyfin 12.0 disables the legacy X-Emby-Token header by default; the
  // Authorization: MediaBrowser scheme is accepted by 10.x and 12.x alike.
  _headers() { return { Authorization: `MediaBrowser Token="${this.apiKey}"` }; }

  // Lookups need the individual videos even when Jellyfin groups collections:
  // a collection container does not carry the videos' watch state.
  _itemListParams() { return { collapseBoxSetItems: false }; }

  async createPlaylist(name, itemIds, opts = {}) {
    const body = {
      Name: name,
      Ids: itemIds,
      UserId: this.userId,
      MediaType: opts.mediaType === 'audio' ? 'Audio' : 'Video',
      IsPublic: !!opts.public,
    };
    const res = await axios.post(`${this.url}/Playlists`, body, { headers: this._headers(), timeout: REQUEST_TIMEOUT_MS });
    return { id: res.data?.Id };
  }
}

module.exports = JellyfinAdapter;
