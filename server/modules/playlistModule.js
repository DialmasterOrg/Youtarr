const { spawn } = require('child_process');
const { Op } = require('sequelize');
const logger = require('../logger');
const { sequelize, Sequelize } = require('../db');
const { Playlist, PlaylistVideo, Channel } = require('../models');
const youtubeApi = require('./youtubeApi');

// yt-dlp's flat-playlist listing still returns private/deleted/members-only
// videos but strips their metadata: the title comes back null (current yt-dlp)
// or as a "[Private video]" / "[Deleted video]" placeholder (older versions).
// Title is the only reliable signal in flat mode; availability/channel_id come
// back null for every entry.
const UNAVAILABLE_TITLE_RE = /^\[(private|deleted|unavailable)\b[^\]]*\]$/i;

// Regular refreshes (subscribe, cron, pre-download) fetch only the first page
// of a playlist so they stay fast and deterministic; the explicit "Load More"
// full fetch is capped like the channel Load More (channelModule).
const DEFAULT_FETCH_LIMIT = 100;
const MAX_LOAD_MORE_VIDEOS = 5000;

// added_at round-trips through a DATETIME column (second precision), so an
// exact millisecond comparison would flag every already-correct row as stale.
const ADDED_AT_TOLERANCE_MS = 1000;

class PlaylistModule {
  constructor() {
    // Concurrent fetches for the same playlist would race on row upserts and video_count.
    this.activeFetches = new Set();
  }

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
    const metadata = {
      playlist_id: data.playlist_id,
      title: data.title,
      url: data.url,
      description: data.description,
      uploader: data.uploader,
      thumbnail: data.thumbnail,
      video_count: data.video_count,
      enabled,
    };
    const existing = await Playlist.findOne({ where: { playlist_id: data.playlist_id } });
    if (existing) {
      // Settings apply only on create: re-subscribing a soft-deleted playlist
      // must restore it exactly as configured before, so only the YouTube
      // metadata and the enabled flag are refreshed here.
      const restored = Boolean(enabled && !existing.enabled);
      await existing.update(metadata);
      return { playlist: existing, restored };
    }
    const playlist = await Playlist.create({ ...metadata, ...settings });
    return { playlist, restored: false };
  }

  async fetchAllPlaylistVideos(playlistId, { fetchAll = false } = {}) {
    if (this.activeFetches.has(playlistId)) {
      throw new Error('FETCH_IN_PROGRESS');
    }
    this.activeFetches.add(playlistId);
    try {
      return await this._fetchPlaylistVideos(playlistId, fetchAll);
    } finally {
      this.activeFetches.delete(playlistId);
    }
  }

  async _fetchPlaylistVideos(playlistId, fetchAll) {
    const playlist = await Playlist.findOne({ where: { playlist_id: playlistId } });
    if (!playlist) throw new Error('PLAYLIST_NOT_FOUND');

    const entries = await this._spawnFlatPlaylist(
      playlist.url,
      fetchAll
        ? { playlistEnd: MAX_LOAD_MORE_VIDEOS, skipWebpage: true }
        : { playlistEnd: DEFAULT_FETCH_LIMIT }
    );

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

    // added_at is deliberately absent: existing rows keep their first-seen
    // timestamp, and backfillFromDownloadedVideos re-stamps downloaded rows.
    await PlaylistVideo.bulkCreate(rows, {
      updateOnDuplicate: [
        'position',
        'channel_id',
        'channel_name',
        'title',
        'thumbnail',
        'duration',
        'published_at',
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

    // video_count comes from the tracked rows, not this fetch's entry count:
    // a capped default fetch after a full "Load More" would otherwise clobber
    // the count back down to the first page's size.
    const totalTracked = await PlaylistVideo.count({
      where: { playlist_id: playlist.playlist_id },
    });

    // Backfill the playlist's own thumbnail from the first available entry's video
    // id when it is missing. yt-dlp's `--playlist-items 0` mode used by
    // getPlaylistInfo does not return a playlist-level thumbnail, leaving the
    // column null on initial subscribe. The first video's hqdefault is what
    // YouTube itself renders as the playlist cover.
    const update = { lastFetched: new Date(), video_count: totalTracked };
    if (!playlist.thumbnail && available[0]?.id) {
      update.thumbnail = `https://i.ytimg.com/vi/${available[0].id}/hqdefault.jpg`;
    }
    await playlist.update(update);

    // Best-effort: a failed reconciliation shouldn't fail the fetch.
    try {
      await this.backfillFromDownloadedVideos(playlist.playlist_id);
    } catch (err) {
      logger.warn({ err, playlist_id: playlist.playlist_id }, 'Downloaded-video reconciliation after playlist fetch failed');
    }

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

  // The webpage extraction path silently stops after the first 100 entries;
  // skip=webpage pages the full playlist via the InnerTube API. If cookies are
  // ever added here, an authenticated jar makes yt-dlp reject skip=webpage
  // unless skip=authcheck is also passed.
  _spawnFlatPlaylist(url, { playlistEnd, skipWebpage = false } = {}) {
    return new Promise((resolve, reject) => {
      const args = ['--flat-playlist', '--dump-json'];
      if (playlistEnd != null) {
        args.push('--playlist-end', String(playlistEnd));
      }
      if (skipWebpage) {
        args.push('--extractor-args', 'youtubetab:skip=webpage');
      }
      args.push(url);
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
    const downloadedAtByVideo = new Map();
    const youtubeIds = new Set();
    const fallbackDownloadedAt = new Date();
    for (const v of videoData) {
      if (!v || !v.youtubeId) continue;
      youtubeIds.add(v.youtubeId);
      // downloadedAt: undefined means "downloaded just now" (the post-download
      // hook), an explicit null means the caller has no reliable download time
      // and added_at must be left alone.
      if (v.downloadedAt !== null) {
        const valid = v.downloadedAt instanceof Date && !Number.isNaN(v.downloadedAt.getTime());
        downloadedAtByVideo.set(v.youtubeId, valid ? v.downloadedAt : fallbackDownloadedAt);
      }
      if (!v.channel_id) continue;
      channelByVideo.set(v.youtubeId, v.channel_id);
      if (v.youTubeChannelName && !nameByChannel.has(v.channel_id)) {
        nameByChannel.set(v.channel_id, v.youTubeChannelName);
      }
    }
    if (youtubeIds.size === 0) return;

    const rows = await PlaylistVideo.findAll({
      where: { youtube_id: [...youtubeIds] },
      attributes: ['playlist_id', 'youtube_id', 'channel_id', 'added_at'],
    });
    if (!rows || !rows.length) return;

    await this._stampDownloadedAddedAt(rows, downloadedAtByVideo);

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

    // Only an enabled playlist may seed a hidden source channel's settings:
    // a soft-deleted playlist's overrides must not keep applying to downloads.
    const candidatePlaylistIds = [...new Set(filledRows.map((row) => row.playlist_id))];
    const playlists = await Playlist.findAll({
      where: { playlist_id: candidatePlaylistIds, enabled: true },
    });
    const playlistById = new Map((playlists || []).map((p) => [p.playlist_id, p]));

    // Pick one enabled owning playlist per channel (first enabled row wins).
    const playlistByChannel = new Map();
    for (const row of filledRows) {
      const realId = channelByVideo.get(row.youtube_id);
      if (realId && untracked.has(realId) && !playlistByChannel.has(realId) && playlistById.has(row.playlist_id)) {
        playlistByChannel.set(realId, row.playlist_id);
      }
    }

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

  // The playlist UI shows added_at as the video's download time, but fetch
  // writes stamp rows with fetch time. Re-stamp rows for downloaded videos,
  // soft-deleted playlists included, so a later re-subscribe stays accurate.
  async _stampDownloadedAddedAt(rows, downloadedAtByVideo) {
    const stale = new Map();
    for (const row of rows) {
      const target = downloadedAtByVideo.get(row.youtube_id);
      if (!target || stale.has(row.youtube_id)) continue;
      const current = row.added_at ? new Date(row.added_at).getTime() : null;
      if (current == null || Math.abs(current - target.getTime()) > ADDED_AT_TOLERANCE_MS) {
        stale.set(row.youtube_id, target);
      }
    }
    for (const [youtubeId, addedAt] of stale) {
      await PlaylistVideo.update(
        { added_at: addedAt },
        { where: { youtube_id: youtubeId } }
      );
    }
  }

  // Reconciles one playlist's tracked rows against videos that already exist in
  // the Videos table: fills channel attribution and re-stamps added_at with the
  // video's actual download time. Runs after every fetch so rows created for
  // videos downloaded by other means (or while the playlist was soft-deleted)
  // pick up the right metadata.
  async backfillFromDownloadedVideos(playlistId) {
    const tracked = await PlaylistVideo.findAll({
      where: { playlist_id: playlistId },
      attributes: ['youtube_id'],
    });
    const youtubeIds = (tracked || []).map((r) => r.youtube_id).filter(Boolean);
    if (!youtubeIds.length) return;

    // Same download-time derivation as videosModule/videoDeletionModule's
    // timeCreated: last download wins, then the download job's creation time,
    // then the upload date.
    const downloaded = await sequelize.query(
      `SELECT
         Videos.youtubeId,
         Videos.channel_id,
         Videos.youTubeChannelName,
         COALESCE(Videos.last_downloaded_at, MAX(Jobs.timeCreated), STR_TO_DATE(Videos.originalDate, '%Y%m%d')) AS downloadedAt
       FROM Videos
       LEFT JOIN JobVideos ON Videos.id = JobVideos.video_id
       LEFT JOIN Jobs ON Jobs.id = JobVideos.job_id
       WHERE Videos.youtubeId IN (:youtubeIds)
       GROUP BY Videos.id`,
      { replacements: { youtubeIds }, type: Sequelize.QueryTypes.SELECT }
    );
    if (!downloaded || !downloaded.length) return;

    await this.backfillDownloadedVideoChannels(downloaded.map((v) => {
      const downloadedAt = v.downloadedAt ? new Date(v.downloadedAt) : null;
      return {
        youtubeId: v.youtubeId,
        channel_id: v.channel_id,
        youTubeChannelName: v.youTubeChannelName,
        downloadedAt: downloadedAt && !Number.isNaN(downloadedAt.getTime()) ? downloadedAt : null,
      };
    }));
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
