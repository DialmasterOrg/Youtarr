const axios = require('axios');
const MediaBrowserAdapter = require('./mediaBrowserAdapter');
const { REQUEST_TIMEOUT_MS } = require('./baseAdapter');

class EmbyAdapter extends MediaBrowserAdapter {
  constructor(config) {
    super(config, {
      serverType: 'emby',
      url: config.embyUrl,
      apiKey: config.embyApiKey,
      userId: config.embyUserId,
      allUsers: config.embyWatchStatusAllUsers,
      videoLibraryIds: config.embyVideoLibraryIds,
    });
  }

  _headers() { return { 'X-Emby-Token': this.apiKey }; }

  // List responses trim UserData (LastPlayedDate dropped, PlayCount zeroed)
  // unless the UserData* fields are requested explicitly.
  _watchStateFields() { return 'Path,UserDataLastPlayedDate,UserDataPlayCount'; }

  async createPlaylist(name, itemIds, opts = {}) {
    // Emby differs from Jellyfin: it expects query params with Ids as a
    // comma-delimited string, not a JSON body with an array. Sending a JSON
    // body shape (what Jellyfin accepts) yields a 500 from Emby.
    //
    // Visibility is set at creation, not via a follow-up call: the
    // Make{Public,Private} and /Items/Access endpoints need a user session and
    // fail (500) under a server API key. So: with a UserId the playlist is
    // owner-only (private); without one it's server-global, visible to all
    // users.
    const params = {
      Name: name,
      Ids: itemIds.join(','),
      MediaType: opts.mediaType === 'audio' ? 'Audio' : 'Video',
    };
    if (!opts.public) {
      params.UserId = this.userId;
    }
    const res = await axios.post(`${this.url}/Playlists`, null, {
      headers: this._headers(),
      params,
      timeout: REQUEST_TIMEOUT_MS,
    });
    return { id: res.data?.Id };
  }
}

module.exports = EmbyAdapter;
