const axios = require('axios');
const path = require('path');
const BaseAdapter = require('./baseAdapter');
const logger = require('../../../logger');
const plexModule = require('../../plexModule');

class PlexAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.url = config.plexUrl;
    this.token = config.plexApiKey;
    this.libraryId = config.plexYoutubeLibraryId;
  }

  async testConnection() {
    try {
      await axios.get(`${this.url}/identity`, { params: { 'X-Plex-Token': this.token } });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async listUsers() { return []; }

  async triggerLibraryScan(subfolder) {
    return plexModule.refreshLibrariesForSubfolders([subfolder].filter(Boolean));
  }

  async resolveItemIdByFilepath(filepath) {
    // Match by filename (basename), not full path. Youtarr sees the file inside
    // its Docker container (e.g. /usr/src/app/data/...), Plex sees it on the host
    // (e.g. /mnt/media/...), so the prefix always differs. Filenames include the
    // YouTube video ID (e.g. "Title [abc123].mp4") which is globally unique.
    const target = path.basename(filepath);
    try {
      const res = await axios.get(`${this.url}/library/sections/${this.libraryId}/all`, {
        params: { 'X-Plex-Token': this.token },
      });
      const items = res.data?.MediaContainer?.Metadata || [];
      for (const item of items) {
        for (const media of item.Media || []) {
          for (const part of media.Part || []) {
            if (part.file && path.basename(part.file) === target) return item.ratingKey;
          }
        }
      }
      return null;
    } catch (err) {
      logger.error({ err, filepath }, 'plex resolveItemIdByFilepath failed');
      return null;
    }
  }

  async getPlaylistByName(name) {
    try {
      const res = await axios.get(`${this.url}/playlists`, {
        params: { 'X-Plex-Token': this.token, playlistType: 'video' },
      });
      const found = (res.data?.MediaContainer?.Metadata || []).find((p) => p.title === name);
      if (!found) return null;
      return { id: found.ratingKey, itemIds: [] };
    } catch (err) {
      logger.error({ err }, 'plex getPlaylistByName failed');
      return null;
    }
  }

  async _getMachineId() {
    const res = await axios.get(`${this.url}/identity`, { params: { 'X-Plex-Token': this.token } });
    return res.data?.MediaContainer?.machineIdentifier;
  }

  async createPlaylist(name, itemIds) {
    const machineId = await this._getMachineId();
    const uri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${itemIds.join(',')}`;
    const res = await axios.post(`${this.url}/playlists`, null, {
      params: { 'X-Plex-Token': this.token, type: 'video', title: name, smart: 0, uri },
    });
    return { id: res.data?.MediaContainer?.Metadata?.[0]?.ratingKey };
  }

  async replacePlaylistItems(playlistId, itemIds) {
    await axios.delete(`${this.url}/playlists/${playlistId}/items`, {
      params: { 'X-Plex-Token': this.token },
    });
    const machineId = await this._getMachineId();
    const uri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${itemIds.join(',')}`;
    await axios.put(`${this.url}/playlists/${playlistId}/items`, null, {
      params: { 'X-Plex-Token': this.token, uri },
    });
  }
}

module.exports = PlexAdapter;
