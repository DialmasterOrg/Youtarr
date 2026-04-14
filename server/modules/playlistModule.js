const { spawn } = require('child_process');
const logger = require('../logger');
const { Playlist, PlaylistVideo } = require('../models');

class PlaylistModule {
  async getPlaylistInfo(url) {
    return new Promise((resolve, reject) => {
      const args = [
        '--skip-download',
        '--dump-single-json',
        '--flat-playlist',
        '--playlist-items', '0',
        url,
      ];
      const child = spawn('yt-dlp', args);
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });

      child.on('close', (code) => {
        if (code !== 0) {
          if (/does not exist|Unable to find/i.test(stderr)) {
            return reject(new Error('PLAYLIST_NOT_FOUND'));
          }
          if (/confirm you.re not a bot|sign in|cookies/i.test(stderr)) {
            return reject(new Error('COOKIES_REQUIRED'));
          }
          logger.error({ stderr, code }, 'getPlaylistInfo failed');
          return reject(new Error('NETWORK_ERROR'));
        }
        try {
          const data = JSON.parse(stdout);
          resolve({
            playlist_id: data.id,
            title: data.title,
            uploader: data.uploader || data.channel || null,
            description: data.description || null,
            thumbnail: data.thumbnail || null,
            video_count: data.playlist_count || 0,
            url: data.webpage_url || url,
          });
        } catch (err) {
          logger.error({ err, stdout }, 'getPlaylistInfo parse error');
          reject(new Error('PARSE_ERROR'));
        }
      });
    });
  }

  async upsertPlaylist(data, opts = {}) {
    const { enabled = false, settings = {} } = opts;
    const payload = {
      playlist_id: data.playlist_id,
      title: data.title,
      url: data.url,
      description: data.description,
      uploader: data.uploader,
      thumbnail: data.thumbnail,
      video_count: data.video_count,
      enabled,
      ...settings,
    };
    const existing = await Playlist.findOne({ where: { playlist_id: data.playlist_id } });
    if (existing) {
      await existing.update(payload);
      return existing;
    }
    return Playlist.create(payload);
  }

  async fetchAllPlaylistVideos(playlistId) {
    const playlist = await Playlist.findOne({ where: { playlist_id: playlistId } });
    if (!playlist) throw new Error('PLAYLIST_NOT_FOUND');

    const entries = await this._spawnFlatPlaylist(playlist.url);

    const regex = playlist.title_filter_regex ? new RegExp(playlist.title_filter_regex, 'i') : null;
    const passes = (e) => {
      if (playlist.min_duration != null && (e.duration || 0) < playlist.min_duration) return false;
      if (playlist.max_duration != null && (e.duration || 0) > playlist.max_duration) return false;
      if (regex && e.title && !regex.test(e.title)) return false;
      return true;
    };

    const rows = entries
      .map((e, idx) => ({ entry: e, row: {
        playlist_id: playlist.playlist_id,
        youtube_id: e.id,
        position: idx + 1,
        channel_id: e.channel_id || null,
        added_at: new Date(),
      }}))
      .filter(({ entry }) => passes(entry))
      .map(({ row }) => row);

    await PlaylistVideo.bulkCreate(rows, {
      updateOnDuplicate: ['position', 'channel_id', 'added_at', 'updatedAt'],
    });

    await playlist.update({ lastFetched: new Date(), video_count: entries.length });
    return rows.length;
  }

  _spawnFlatPlaylist(url) {
    return new Promise((resolve, reject) => {
      const args = ['--flat-playlist', '--dump-json', url];
      const child = spawn('yt-dlp', args);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('close', (code) => {
        if (code !== 0) {
          logger.error({ stderr, code }, '_spawnFlatPlaylist failed');
          return reject(new Error('NETWORK_ERROR'));
        }
        try {
          const entries = stdout.split('\n').filter(Boolean).map((line) => JSON.parse(line));
          resolve(entries);
        } catch (err) {
          reject(new Error('PARSE_ERROR'));
        }
      });
    });
  }

  async ensureSourceChannel(uploaderInfo, playlist) {
    const channelModule = require('./channelModule');
    const seed = {
      sub_folder: playlist.default_sub_folder,
      video_quality: playlist.video_quality,
      min_duration: playlist.min_duration,
      max_duration: playlist.max_duration,
      title_filter_regex: playlist.title_filter_regex,
      audio_format: playlist.audio_format,
      default_rating: playlist.default_rating,
    };
    return channelModule.upsertChannel(
      { channel_id: uploaderInfo.channel_id, uploader: uploaderInfo.uploader, url: uploaderInfo.url },
      false,
      null,
      seed
    );
  }

  async playlistAutoDownload() {
    const downloadModule = require('./downloadModule');
    const playlists = await Playlist.findAll({
      where: { enabled: true, auto_download: true },
    });
    for (const p of playlists) {
      try {
        await downloadModule.doPlaylistDownloads(p);
      } catch (err) {
        logger.error({ err, playlist_id: p.playlist_id }, 'playlistAutoDownload failed for playlist');
      }
    }
  }
}

module.exports = new PlaylistModule();
