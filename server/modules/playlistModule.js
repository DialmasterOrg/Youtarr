const { spawn } = require('child_process');
const logger = require('../logger');
const { Playlist, PlaylistVideo } = require('../models');
const { GLOBAL_DEFAULT_SENTINEL } = require('./filesystem/constants');

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

    const pickThumbnail = (e) => {
      if (typeof e.thumbnail === 'string' && e.thumbnail) return e.thumbnail;
      if (Array.isArray(e.thumbnails) && e.thumbnails.length > 0) {
        const last = e.thumbnails[e.thumbnails.length - 1];
        if (last && typeof last.url === 'string') return last.url;
      }
      return e.id ? `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg` : null;
    };

    const rows = entries
      .map((e, idx) => ({ entry: e, row: {
        playlist_id: playlist.playlist_id,
        youtube_id: e.id,
        position: idx + 1,
        channel_id: e.channel_id || null,
        channel_name: e.uploader || e.channel || null,
        title: e.title || null,
        thumbnail: pickThumbnail(e),
        duration: typeof e.duration === 'number' ? e.duration : null,
        published_at: e.upload_date || e.release_date || null,
        added_at: new Date(),
      }}))
      .filter(({ entry }) => passes(entry))
      .map(({ row }) => row);

    await PlaylistVideo.bulkCreate(rows, {
      updateOnDuplicate: [
        'position',
        'channel_id',
        'channel_name',
        'title',
        'thumbnail',
        'duration',
        'published_at',
        'added_at',
        'updatedAt',
      ],
    });

    // Backfill the playlist's own thumbnail from the first entry's video id when
    // it is missing. yt-dlp's `--playlist-items 0` mode used by getPlaylistInfo
    // does not return a playlist-level thumbnail, leaving the column null on
    // initial subscribe. The first video's hqdefault is what YouTube itself
    // renders as the playlist cover.
    const update = { lastFetched: new Date(), video_count: entries.length };
    if (!playlist.thumbnail && entries[0]?.id) {
      update.thumbnail = `https://i.ytimg.com/vi/${entries[0].id}/hqdefault.jpg`;
    }
    await playlist.update(update);
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
    // When the playlist itself doesn't specify a default_sub_folder, seed the
    // auto-created channel with GLOBAL_DEFAULT_SENTINEL so downloads land in
    // the configured global default subfolder — users who have a media-server
    // library pointed at that subfolder will see the videos. A bare null
    // would route to the filesystem root, which is rarely what the user wants.
    const seed = {
      sub_folder: playlist.default_sub_folder || GLOBAL_DEFAULT_SENTINEL,
      video_quality: playlist.video_quality,
      min_duration: playlist.min_duration,
      max_duration: playlist.max_duration,
      title_filter_regex: playlist.title_filter_regex,
      audio_format: playlist.audio_format,
      default_rating: playlist.default_rating,
    };
    // upsertChannel expects the YouTube channel ID under `id` (matches yt-dlp's
    // metadata shape). When the caller only has a channel_id (as in
    // doPlaylistDownloads), synthesize a canonical channel URL — yt-dlp resolves
    // `https://www.youtube.com/channel/<UCxxx>` correctly, and uploader is
    // populated later when the user activates or refreshes the channel.
    const channelId = uploaderInfo.id || uploaderInfo.channel_id;
    const url = uploaderInfo.url || (channelId ? `https://www.youtube.com/channel/${channelId}` : null);
    return channelModule.upsertChannel(
      { id: channelId, uploader: uploaderInfo.uploader || null, url },
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
