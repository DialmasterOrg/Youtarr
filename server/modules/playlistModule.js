const { spawn } = require('child_process');
const { Op } = require('sequelize');
const logger = require('../logger');
const { sequelize } = require('../db');
const { Playlist, PlaylistVideo, Channel, Video, Job, JobVideo } = require('../models');
const youtubeApi = require('./youtubeApi');
const { MAX_PLAYLIST_VIDEOS } = require('./playlistConstants');
const storageGuard = require('./storageGuard');

// yt-dlp's flat-playlist listing still returns private/deleted/members-only
// videos but strips their metadata: the title comes back null (current yt-dlp)
// or as a "[Private video]" / "[Deleted video]" placeholder (older versions).
// Title is the only reliable signal in flat mode; availability/channel_id come
// back null for every entry.
const UNAVAILABLE_TITLE_RE = /^\[(private|deleted|unavailable)\b[^\]]*\]$/i;

// Ordinary refreshes tolerate small reported-count drift before retrying.
// Establishing a baseline and pruning require an exact, independently verified count.
const REPORTED_COUNT_SLACK = 5;

// downloaded_at round-trips through a DATETIME column (second precision), so an
// exact millisecond comparison would flag every already-correct row as stale.
const DOWNLOAD_TIME_TOLERANCE_MS = 1000;

function reportedCount(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

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
    const data = await this._getPlaylistMetadata(url);
    return {
      playlist_id: data.id,
      title: data.title,
      uploader: data.uploader || data.channel || null,
      description: data.description || null,
      thumbnail: data.thumbnail || null,
      video_count: reportedCount(data.playlist_count) ?? 0,
      url: data.webpage_url || url,
    };
  }

  async _getPlaylistMetadata(url, { skipWebpage = false } = {}) {
    return new Promise((resolve, reject) => {
      const args = [
        '--skip-download',
        '--dump-single-json',
        '--flat-playlist',
        '--playlist-items', '0',
      ];
      if (skipWebpage) args.push('--extractor-args', 'youtubetab:skip=webpage');
      args.push(url);
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
          resolve(JSON.parse(stdout));
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

  async refreshForFollowing(playlist, { followFromNow = true, resetFollowing = false } = {}) {
    const count = await this.fetchAllPlaylistVideos(playlist.playlist_id, { followFromNow, resetFollowing });
    await playlist.reload();
    return count;
  }

  isFollowingSetupError(err) {
    return ['PLAYLIST_TOO_LARGE', 'PLAYLIST_REFRESH_INCOMPLETE'].includes(err.message);
  }

  // Recover only first-time setup failures. Hold the same fetch guard through
  // the fallback so another setup cannot stamp a baseline halfway through it.
  async recoverFollowingSetup(playlist, err, { disableAutoDownload = false } = {}) {
    if (!this.isFollowingSetupError(err)) throw err;
    const playlistId = playlist.playlist_id;
    if (this.activeFetches.has(playlistId)) {
      return 'Playlist saved. Another refresh is in progress; check its following status when it finishes.';
    }
    this.activeFetches.add(playlistId);
    try {
      await playlist.reload();
      if (!playlist.enabled || playlist.auto_download_baseline_at) {
        return 'Playlist saved. Following settings changed during setup; the current settings were kept.';
      }
      const pause = disableAutoDownload || err.message === 'PLAYLIST_TOO_LARGE';
      // Compare the settings we just read: a concurrent pause or unsubscribe
      // must not be undone by this recovery, nor may a new baseline be changed.
      const [updated] = await Playlist.update({
        auto_download_setup_error: err.message,
        ...(pause && { auto_download: false }),
      }, { where: {
        playlist_id: playlistId, enabled: true,
        auto_download: playlist.auto_download, auto_download_baseline_at: null,
      } });
      if (!updated) {
        await playlist.reload();
        return 'Playlist saved. Following settings changed during setup; the current settings were kept.';
      }
      let warning = err.message === 'PLAYLIST_TOO_LARGE'
        ? `Playlist saved. Auto-download was turned off because automatic following supports up to ${MAX_PLAYLIST_VIDEOS.toLocaleString('en-US')} entries. You can still choose tracked videos manually.`
        : `Playlist saved. YouTube did not provide a complete starting snapshot. ${pause ? 'Auto-download was turned off; retry setup later.' : 'Auto-download is waiting for a complete starting snapshot and will retry on scheduled runs.'}`;
      try {
        // A partial snapshot can update the listing, but cannot start following
        // or prune missing entries. Saved batch requests are left untouched.
        await this._fetchPlaylistVideos(playlistId);
      } catch (refreshError) {
        logger.error({ err: refreshError, playlist_id: playlistId }, 'Playlist setup fallback refresh failed');
        warning += ' The video listing could not be refreshed either; try refreshing it later.';
      }
      await playlist.reload();
      return warning;
    } finally {
      this.activeFetches.delete(playlistId);
    }
  }

  /**
   * The RegExp a playlist title filter is evaluated with on refresh. The
   * settings route uses it to reject a pattern that would break every refresh.
   * @param {string} pattern
   * @returns {RegExp}
   * @throws {SyntaxError} when the pattern is not a valid JavaScript regex
   */
  buildTitleFilterRegExp(pattern) {
    return new RegExp(pattern, 'i');
  }

  async fetchAllPlaylistVideos(playlistId, options = {}) {
    if (this.activeFetches.has(playlistId)) {
      throw new Error('FETCH_IN_PROGRESS');
    }
    this.activeFetches.add(playlistId);
    try {
      return await this._fetchPlaylistVideos(playlistId, options);
    } finally {
      this.activeFetches.delete(playlistId);
    }
  }

  async _fetchPlaylistVideos(playlistId, { followFromNow = false, resetFollowing = false } = {}) {
    const playlist = await Playlist.findOne({ where: { playlist_id: playlistId } });
    if (!playlist) throw new Error('PLAYLIST_NOT_FOUND');
    // A stale first-enable request must not reset tracking established meanwhile.
    const startFollowing = followFromNow && (resetFollowing || !playlist.auto_download_baseline_at);

    const { entries, complete } = await this._fetchSnapshot(playlist, startFollowing);

    const discoveredAt = new Date();
    const available = entries.filter((e) => !this.isUnavailableTitle(e.title));

    const regex = playlist.title_filter_regex ? this.buildTitleFilterRegExp(playlist.title_filter_regex) : null;
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
        added_at: discoveredAt,
        first_seen_at: discoveredAt,
      }}))
      .filter(({ entry }) => passes(entry))
      .map(({ row }) => row);

    await this._preserveExistingPublishedDates(playlist.playlist_id, rows);
    await this._preserveExistingChannelInfo(playlist.playlist_id, rows);
    await this._backfillPublishedDates(rows);

    // Discovery dates and explicit download requests are never overwritten by
    // refresh. Download times are reconciled separately below.
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
    // Unknown counts and partial fetches cannot prove that missing entries were
    // removed. A confirmed empty playlist can safely clear the tracked rows.
    if (complete) {
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
    if (startFollowing) {
      // The fetch guard remains held while capturing the last known entry.
      // An id boundary also works for empty playlists and same-second refreshes.
      const baselineId = await PlaylistVideo.max('id', { where: { playlist_id: playlistId } }) || 0;
      await sequelize.transaction(async (transaction) => {
        if (resetFollowing) {
          await PlaylistVideo.update(
            { auto_download_requested: false },
            { where: { playlist_id: playlistId }, transaction }
          );
        }
        await playlist.update({
          ...update,
          auto_download_baseline_at: new Date(),
          auto_download_baseline_id: baselineId,
          auto_download_setup_error: null,
        }, { transaction });
      });
    } else {
      await playlist.update(update);
    }

    // Best-effort: a failed reconciliation shouldn't fail the fetch.
    try {
      await this.backfillFromDownloadedVideos(playlist.playlist_id);
    } catch (err) {
      logger.warn({ err, playlist_id: playlist.playlist_id }, 'Downloaded-video reconciliation after playlist fetch failed');
    }

    return rows.length;
  }

  async _fetchSnapshot(playlist, startFollowing) {
    // A metadata-only request does not walk the entries, so yt-dlp cannot
    // substitute the length of a truncated extraction for YouTube's total.
    // n_entries (and sometimes per-entry playlist_count) describe extraction,
    // not independent evidence that pagination finished.
    let metadataCount = null;
    try {
      metadataCount = reportedCount((await this._getPlaylistMetadata(playlist.url)).playlist_count);
    } catch (err) {
      logger.warn({ err, playlist_id: playlist.playlist_id }, 'Could not verify playlist size from metadata');
    }
    if (metadataCount == null) {
      try {
        metadataCount = reportedCount((await this._getPlaylistMetadata(playlist.url, { skipWebpage: true })).playlist_count);
      } catch (err) {
        logger.warn({ err, playlist_id: playlist.playlist_id }, 'Could not verify playlist size through InnerTube');
      }
    }
    if (startFollowing && metadataCount > MAX_PLAYLIST_VIDEOS) {
      throw new Error('PLAYLIST_TOO_LARGE');
    }
    const counts = new Set(metadataCount == null ? [] : [metadataCount]);
    const rememberCounts = (result) => {
      for (const entry of result) {
        const count = reportedCount(entry.playlist_count);
        if (count != null) counts.add(count);
      }
    };
    const expectedCount = () => counts.size ? Math.max(...counts) : null;
    const innertubeOpts = { playlistEnd: MAX_PLAYLIST_VIDEOS, skipWebpage: true };
    let entries;
    let usedInnertube = false;
    try {
      entries = await this._spawnFlatPlaylist(playlist.url, { playlistEnd: MAX_PLAYLIST_VIDEOS });
    } catch (err) {
      logger.warn({ err, playlist_id: playlist.playlist_id }, 'Default playlist fetch failed; retrying via InnerTube');
      entries = await this._spawnFlatPlaylist(playlist.url, innertubeOpts);
      usedInnertube = true;
    }
    rememberCounts(entries);
    const expected = expectedCount();
    const slack = startFollowing ? 0 : REPORTED_COUNT_SLACK;
    if (!usedInnertube && (entries.length === 0 ||
      (expected != null && entries.length + slack < Math.min(expected, MAX_PLAYLIST_VIDEOS)))) {
      logger.warn({ playlist_id: playlist.playlist_id, fetched: entries.length, expected },
        'Playlist fetch came back empty or short of reported count; retrying via InnerTube');
      try {
        const fallback = await this._spawnFlatPlaylist(playlist.url, innertubeOpts);
        usedInnertube = true;
        rememberCounts(fallback);
        if (fallback.length > entries.length) entries = fallback;
      } catch (err) {
        logger.warn({ err, playlist_id: playlist.playlist_id }, 'InnerTube fallback fetch failed; keeping the default fetch result');
      }
    }
    if (entries.length >= MAX_PLAYLIST_VIDEOS) {
      logger.warn({ playlist_id: playlist.playlist_id, fetched: entries.length, cap: MAX_PLAYLIST_VIDEOS },
        'Playlist fetch hit the entry cap; videos beyond the cap are not tracked');
    }
    // Smaller per-entry totals may themselves be synthesized from a truncated
    // extraction. A larger total remains evidence that entries are missing.
    const complete = metadataCount != null && entries.length === metadataCount && expectedCount() === metadataCount;
    if (startFollowing && expectedCount() > MAX_PLAYLIST_VIDEOS) {
      throw new Error('PLAYLIST_TOO_LARGE');
    }
    if (startFollowing && !complete) {
      logger.warn({ playlist_id: playlist.playlist_id, fetched: entries.length, metadataCount, reportedCounts: [...counts] },
        'Following requires a verifiably complete playlist snapshot');
      throw new Error('PLAYLIST_REFRESH_INCOMPLETE');
    }
    return { entries, complete };
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

  // Default (webpage) extraction paginates fully on yt-dlp >= 2026.07.04.
  // skipWebpage (InnerTube-only) is the fallback used by _fetchPlaylistVideos
  // when the default path fails or under-delivers; it stops at ~200 entries
  // for playlist views as of 2026-07. If cookies are ever added here, an
  // authenticated jar makes yt-dlp reject skip=webpage unless skip=authcheck
  // is also passed.
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
      // and downloaded_at must be left alone.
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
      attributes: ['playlist_id', 'youtube_id', 'channel_id', 'downloaded_at'],
    });
    if (!rows || !rows.length) return;

    await this._stampDownloadedAt(rows, downloadedAtByVideo);

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

  // Downloading must never change discovery order. Reconcile only download
  // timestamps, including soft-deleted playlists that may later be restored.
  async _stampDownloadedAt(rows, downloadedAtByVideo) {
    const stale = new Map();
    for (const row of rows) {
      const target = downloadedAtByVideo.get(row.youtube_id);
      if (!target || stale.has(row.youtube_id)) continue;
      const current = row.downloaded_at ? new Date(row.downloaded_at).getTime() : null;
      if (current == null || Math.abs(current - target.getTime()) > DOWNLOAD_TIME_TOLERANCE_MS) {
        stale.set(row.youtube_id, target);
      }
    }
    for (const [youtubeId, downloadedAt] of stale) {
      await PlaylistVideo.update(
        { downloaded_at: downloadedAt },
        { where: { youtube_id: youtubeId } }
      );
    }
  }

  // Reconciles one playlist's tracked rows against videos that already exist in
  // the Videos table: fills channel attribution and downloaded_at with the
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

    // Use recorded download/job times. A publication date cannot tell us when
    // the local file was downloaded; leave unknown download times unset.
    const downloaded = await Video.findAll({
      attributes: [
        'youtubeId',
        'channel_id',
        'youTubeChannelName',
        [
          sequelize.fn(
            'COALESCE',
            sequelize.col('Video.last_downloaded_at'),
            sequelize.fn('MAX', sequelize.col('jobVideos->job.time_created')),
          ),
          'downloadedAt',
        ],
      ],
      include: [{
        model: JobVideo,
        as: 'jobVideos',
        attributes: [],
        include: [{
          model: Job,
          as: 'job',
          attributes: [],
        }],
      }],
      where: {
        youtubeId: youtubeIds,
      },
      group: 'Video.id',
      raw: true,
    });
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
    let totalEnqueued = 0;
    // One failing playlist must not stop the others, but the sweep reports
    // every failure so the scheduled run isn't recorded as a clean success.
    const errors = [];
    // A storage pause is not a playlist failure: every remaining playlist
    // would be refused the same way, so stop and report the pause instead.
    let pausedReason = null;
    for (const p of playlists) {
      try {
        const enqueued = await downloadModule.doPlaylistDownloads(p, { refreshFirst: true, limitToRecent: true, overrideSettings, runId });
        totalEnqueued += enqueued || 0;
      } catch (err) {
        if (storageGuard.isPausedError(err)) {
          pausedReason = err.message;
          logger.info({ playlist_id: p.playlist_id }, 'Downloads paused for storage; skipping the rest of the playlist sweep');
          break;
        }
        errors.push({ playlistId: p.playlist_id, message: err.message || 'Unknown error' });
        logger.error({ err, playlist_id: p.playlist_id }, 'playlistAutoDownload failed for playlist');
      }
    }

    if (playlists.length > 0 && totalEnqueued === 0 && errors.length === 0 && !pausedReason) {
      try {
        const jobModule = require('./jobModule');
        const { PLAYLIST_SWEEP_LABEL } = require('./download/jobTypes');
        // Empty videos array so Download History treats the fresh in-memory job
        // like any completed no-video job (hidden unless "Show jobs with no
        // videos" is checked), matching the shape DB hydration produces.
        await jobModule.addJob({ jobType: PLAYLIST_SWEEP_LABEL, status: 'Complete', output: '', data: { videos: [] } });
        logger.info({ playlistsChecked: playlists.length }, 'Playlist auto-download sweep found no new videos; recorded idle sweep in history');
      } catch (err) {
        logger.error({ err }, 'Failed to record idle playlist auto-download sweep in history');
      }
    }

    return { playlists: playlists.length, enqueued: totalEnqueued, failed: errors.length, errors, pausedReason };
  }
}

module.exports = new PlaylistModule();
