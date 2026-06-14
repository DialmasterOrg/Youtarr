const { spawn } = require('child_process');
const { Op } = require('sequelize');
const logger = require('../logger');
const { Playlist, PlaylistVideo, Channel } = require('../models');
const youtubeApi = require('./youtubeApi');

// yt-dlp's flat-playlist listing still returns private/deleted/members-only
// videos but strips their metadata: the title comes back null (current yt-dlp)
// or as a "[Private video]" / "[Deleted video]" placeholder (older versions).
// Title is the only reliable signal in flat mode; availability/channel_id come
// back null for every entry.
const UNAVAILABLE_TITLE_RE = /^\[(private|deleted|unavailable)\b[^\]]*\]$/i;

class PlaylistModule {
  isUnavailableTitle(title) {
    if (title == null) return true;
    const trimmed = String(title).trim();
    if (!trimmed) return true;
    return UNAVAILABLE_TITLE_RE.test(trimmed);
  }
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

    const available = entries.filter((e) => !this.isUnavailableTitle(e.title));

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

    const rows = available
      .map((e, idx) => ({ entry: e, row: {
        playlist_id: playlist.playlist_id,
        youtube_id: e.id,
        position: idx + 1,
        // yt-dlp sometimes omits per-video channel fields from flat playlist
        // listings (the same playlist can flip between fetches). Never substitute
        // the playlist owner's channel: this field drives per-video command
        // settings and owner-channel routing at finalize, and the owner's id
        // mis-routes other artists' videos. Leave null and carry forward any
        // previously-captured attribution (_preserveExistingChannelInfo).
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

    await this._preserveExistingPublishedDates(playlist.playlist_id, rows);
    await this._preserveExistingChannelInfo(playlist.playlist_id, rows);
    await this._backfillPublishedDates(rows);

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

    // Prune rows that are no longer in the live playlist (went private, or were
    // removed on YouTube) so they stop showing in Youtarr and stop being queued.
    // Skip pruning on a partial or empty fetch: yt-dlp reports the full count per
    // entry, so fewer entries than reported means a glitch, not real deletions.
    const reportedCount = Number(entries[0]?.playlist_count ?? entries[0]?.n_entries) || null;
    const fetchLooksComplete =
      entries.length > 0 && (reportedCount == null || entries.length >= reportedCount);
    if (fetchLooksComplete) {
      const keepIds = available.map((e) => e.id).filter(Boolean);
      const where = { playlist_id: playlist.playlist_id };
      if (keepIds.length) where.youtube_id = { [Op.notIn]: keepIds };
      await PlaylistVideo.destroy({ where });
    }

    // Backfill the playlist's own thumbnail from the first available entry's video
    // id when it is missing. yt-dlp's `--playlist-items 0` mode used by
    // getPlaylistInfo does not return a playlist-level thumbnail, leaving the
    // column null on initial subscribe. The first video's hqdefault is what
    // YouTube itself renders as the playlist cover.
    const update = { lastFetched: new Date(), video_count: available.length };
    if (!playlist.thumbnail && available[0]?.id) {
      update.thumbnail = `https://i.ytimg.com/vi/${available[0].id}/hqdefault.jpg`;
    }
    await playlist.update(update);
    return rows.length;
  }

  // The flat-playlist refresh rebuilds every row with a null published_at, and
  // published_at is in bulkCreate's updateOnDuplicate list. Without this, a
  // re-fetch while the API is unavailable would overwrite a previously-stored
  // date with null. Carry forward any date we already have in the DB so we only
  // ever fall back to the API for genuinely-new videos.
  async _preserveExistingPublishedDates(playlistId, rows) {
    const missing = rows.filter((r) => !r.published_at && r.youtube_id);
    if (!missing.length) return;
    const existing = await PlaylistVideo.findAll({
      where: { playlist_id: playlistId, youtube_id: missing.map((r) => r.youtube_id) },
      attributes: ['youtube_id', 'published_at'],
    });
    const byId = new Map(
      (existing || [])
        .filter((r) => r.published_at)
        .map((r) => [r.youtube_id, r.published_at])
    );
    for (const row of missing) {
      const date = byId.get(row.youtube_id);
      if (date) row.published_at = date;
    }
  }

  // Like published_at above: a stripped flat listing rebuilds rows with null
  // channel fields, and both are in bulkCreate's updateOnDuplicate list. Carry
  // forward attribution captured by a previous good fetch so it isn't erased,
  // while a fresh non-null value still wins (self-heals stale rows).
  async _preserveExistingChannelInfo(playlistId, rows) {
    const missing = rows.filter((r) => !r.channel_id && r.youtube_id);
    if (!missing.length) return;
    const existing = await PlaylistVideo.findAll({
      where: { playlist_id: playlistId, youtube_id: missing.map((r) => r.youtube_id) },
      attributes: ['youtube_id', 'channel_id', 'channel_name'],
    });
    const byId = new Map(
      (existing || [])
        .filter((r) => r.channel_id)
        .map((r) => [r.youtube_id, r])
    );
    for (const row of missing) {
      const stored = byId.get(row.youtube_id);
      if (stored) {
        row.channel_id = stored.channel_id;
        if (!row.channel_name) row.channel_name = stored.channel_name;
      }
    }
  }

  // yt-dlp flat-playlist omits upload_date for YouTube, so most not-yet-downloaded
  // videos have a null published_at. When a YouTube Data API key is configured, fill
  // those in via the batched videos.list endpoint (1 quota unit per 50 ids). Any
  // failure leaves the dates null.
  async _backfillPublishedDates(rows) {
    const apiKey = youtubeApi.getApiKey();
    if (!apiKey || !youtubeApi.isAvailable()) return;
    const missing = rows.filter((r) => !r.published_at && r.youtube_id);
    if (!missing.length) return;
    try {
      const meta = await youtubeApi.client.getVideoMetadata(
        apiKey,
        missing.map((r) => r.youtube_id)
      );
      const byId = new Map((meta || []).map((m) => [m.id, m.uploadDate]));
      for (const row of missing) {
        const date = byId.get(row.youtube_id);
        if (date) row.published_at = date;
      }
    } catch (err) {
      logger.warn({ err }, 'published_at backfill via YouTube API failed; leaving dates null');
    }
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
    // Seed the auto-created channel with the playlist's subfolder choice as-is:
    // the sentinel (the default for new playlists) -> global default subfolder,
    // null -> explicit root, a name -> that folder. This keeps the seeded
    // channel consistent with the playlist's settings dialog.
    const seed = {
      sub_folder: playlist.default_sub_folder,
      video_quality: playlist.video_quality,
      min_duration: playlist.min_duration,
      max_duration: playlist.max_duration,
      title_filter_regex: playlist.title_filter_regex,
      audio_format: playlist.audio_format,
      default_rating: playlist.default_rating,
    };
    // upsertChannel expects the YouTube channel ID under `id` (matches yt-dlp's
    // metadata shape). When the caller only has a channel_id (as in
    // doPlaylistDownloads), synthesize a canonical channel URL; yt-dlp resolves
    // `https://www.youtube.com/channel/<UCxxx>` correctly. Seed title and uploader
    // from the playlist's stored channel_name so the hidden channel isn't left
    // nameless; they are refined when the user activates or refreshes the channel.
    const channelId = uploaderInfo.id || uploaderInfo.channel_id;
    const name = uploaderInfo.uploader || null;
    const url = uploaderInfo.url || (channelId ? `https://www.youtube.com/channel/${channelId}` : null);
    return channelModule.upsertChannel(
      { id: channelId, title: name, uploader: name, url },
      false,
      null,
      seed
    );
  }

  // A finished download's .info.json carries a per-video channel_id that the
  // flat-playlist listing often omits, leaving playlist_video.channel_id null.
  // Fill it onto the still-null rows and auto-create a hidden (enabled=0) source
  // channel, seeded from the owning playlist, for any new channel not yet
  // tracked. A non-null channel_id came from playlist sync and wins: the
  // .info.json id is the auto-generated upload channel for VEVO/Topic videos, so
  // it must not overwrite a stored owner or spawn a channel from that upload id.
  // Runs once per job here, not in the per-video --exec post-processor, which
  // lacks playlist context and races across concurrent videos.
  async backfillDownloadedVideoChannels(videoData) {
    if (!Array.isArray(videoData) || videoData.length === 0) return;

    const channelByVideo = new Map();
    const nameByChannel = new Map();
    for (const v of videoData) {
      if (!v || !v.youtubeId || !v.channel_id) continue;
      channelByVideo.set(v.youtubeId, v.channel_id);
      if (v.youTubeChannelName && !nameByChannel.has(v.channel_id)) {
        nameByChannel.set(v.channel_id, v.youTubeChannelName);
      }
    }
    if (channelByVideo.size === 0) return;

    const rows = await PlaylistVideo.findAll({
      where: { youtube_id: [...channelByVideo.keys()] },
      attributes: ['playlist_id', 'youtube_id', 'channel_id'],
    });
    if (!rows.length) return;

    const filledRows = rows.filter((row) => !row.channel_id && channelByVideo.get(row.youtube_id));
    if (filledRows.length === 0) return;

    // Keyed on youtube_id so one update fills every playlist still missing it.
    const needsUpdate = new Set(filledRows.map((row) => row.youtube_id));
    for (const youtubeId of needsUpdate) {
      await PlaylistVideo.update(
        { channel_id: channelByVideo.get(youtubeId) },
        { where: { youtube_id: youtubeId, channel_id: null } }
      );
    }

    // Auto-create source channels only for the just-filled rows. Channels behind
    // already-attributed rows were handled at download-trigger time.
    const realChannelIds = [...new Set(filledRows.map((row) => channelByVideo.get(row.youtube_id)).filter(Boolean))];
    const tracked = await Channel.findAll({
      where: { channel_id: realChannelIds },
      attributes: ['channel_id'],
    });
    const trackedIds = new Set((tracked || []).map((c) => c.channel_id));
    const untracked = new Set(realChannelIds.filter((id) => !trackedIds.has(id)));
    if (untracked.size === 0) return;

    // Pick one owning playlist per channel (first row wins) to seed its settings.
    const playlistByChannel = new Map();
    for (const row of filledRows) {
      const realId = channelByVideo.get(row.youtube_id);
      if (realId && untracked.has(realId) && !playlistByChannel.has(realId)) {
        playlistByChannel.set(realId, row.playlist_id);
      }
    }
    const playlists = await Playlist.findAll({
      where: { playlist_id: [...new Set(playlistByChannel.values())] },
    });
    const playlistById = new Map((playlists || []).map((p) => [p.playlist_id, p]));

    for (const channelId of untracked) {
      const playlist = playlistById.get(playlistByChannel.get(channelId));
      if (!playlist) continue;
      try {
        await this.ensureSourceChannel(
          { channel_id: channelId, uploader: nameByChannel.get(channelId) || null },
          playlist
        );
      } catch (err) {
        logger.error({ err, channelId }, 'Failed to auto-create source channel for downloaded playlist video');
      }
    }
  }

  async playlistAutoDownload(overrideSettings = {}, runId) {
    const downloadModule = require('./downloadModule');
    const playlists = await Playlist.findAll({
      where: { enabled: true, auto_download: true },
    });
    for (const p of playlists) {
      try {
        await downloadModule.doPlaylistDownloads(p, { refreshFirst: true, limitToRecent: true, overrideSettings, runId });
      } catch (err) {
        logger.error({ err, playlist_id: p.playlist_id }, 'playlistAutoDownload failed for playlist');
      }
    }
  }
}

module.exports = new PlaylistModule();
