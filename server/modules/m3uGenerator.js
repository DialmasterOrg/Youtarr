const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const { Playlist, PlaylistVideo, Video, Channel } = require('../models');
const { sanitizeNameLikeYtDlp } = require('./filesystem/sanitizer');
const {
  buildChannelPath,
  resolveEffectiveSubfolder,
  resolveChannelFolderName,
} = require('./filesystem/pathBuilder');
const configModule = require('./configModule');
const { M3U_FOLDER_NAME } = require('./filesystem/constants');
const { REMOVAL_STATES, removalState } = require('./videoRemovalState');

// Empty marker file that tells the Jellyfin and Emby library scanners to skip
// this folder. Without it, those servers auto-import the .m3u files as duplicate
// (and on Jellyfin, empty) playlists alongside the ones created via native API
// sync. Both servers honor a file literally named ".ignore".
const SCANNER_IGNORE_FILE = '.ignore';
// Keeps large channels fast without flooding slow SMB/NAS mounts.
const FILE_EXISTENCE_CHECK_CONCURRENCY = 25;
const M3U_EXTENSION = '.m3u';
// Video + MP3 writes a second list of the mp3s next to the video list (#925).
const DUAL_AUDIO_FORMAT = 'video_mp3';
const MP3_LIST_SUFFIX = ' (MP3)';
// Comment line naming the playlist or channel an MP3 list was generated for.
// The name alone proves nothing: a user's own file, another playlist's main
// list or a same-named subscription's MP3 list can sit at that path, so only
// a file carrying this exact line is ever written over or removed.
const MP3_LIST_OWNER_TAG = '#YOUTARR-MP3-LIST:';
const MP3_LIST_HEADER_LINES = 3;
const OWNERSHIP = { ABSENT: 'absent', OWN: 'own', FOREIGN: 'foreign' };

/**
 * Which file an item contributes to the main list and to the MP3 list.
 * Video + MP3 splits the two formats with no fallback; the single-list types
 * prefer their own format and fall back so no downloaded item is dropped.
 * @param {{ filePath?: string|null, audioFilePath?: string|null }} video
 * @param {string|null} audioFormat - 'video_mp3', 'mp3_only', or null for video only
 * @returns {{ main: string|null, mp3: string|null }}
 */
function resolveEntryPaths(video, audioFormat) {
  if (audioFormat === DUAL_AUDIO_FORMAT) {
    return { main: video.filePath || null, mp3: video.audioFilePath || null };
  }
  const main = audioFormat === 'mp3_only'
    ? (video.audioFilePath || video.filePath)
    : (video.filePath || video.audioFilePath);
  return { main: main || null, mp3: null };
}

function mp3ListPath(m3uPath) {
  return `${m3uPath.slice(0, -M3U_EXTENSION.length)}${MP3_LIST_SUFFIX}${M3U_EXTENSION}`;
}

function m3uHeader(title, ownerLine = null) {
  return ['#EXTM3U', `#PLAYLIST:${title}`, ...(ownerLine ? [ownerLine] : [])];
}

/**
 * @param {'playlist'|'channel'} kind
 * @param {string} id - The YouTube playlist or channel id
 */
function mp3ListOwnerLine(kind, id) {
  return `${MP3_LIST_OWNER_TAG}${kind}:${id}`;
}

async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

class M3uGenerator {
  constructor() {
    this._rebuildQueues = new Map();
  }

  /**
   * Run the rebuilds of one playlist or channel one at a time. Each reads its
   * settings when it starts, so a slow rebuild that began under an older
   * Download Type cannot finish last and put back files a newer one removed.
   * @param {string} key
   * @param {() => Promise<*>} task
   */
  _serialized(key, task) {
    const previous = this._rebuildQueues.get(key) || Promise.resolve();
    const run = previous.then(task, task);
    this._rebuildQueues.set(key, run);
    const forget = () => {
      if (this._rebuildQueues.get(key) === run) this._rebuildQueues.delete(key);
    };
    run.then(forget, forget);
    return run;
  }

  generatePlaylistM3U(playlistId) {
    return this._serialized(`playlist:${playlistId}`, () => this._generatePlaylistM3U(playlistId));
  }

  async _generatePlaylistM3U(playlistId) {
    try {
      const playlist = await Playlist.findByPk(playlistId);
      if (!playlist) {
        logger.warn({ playlistId }, 'generatePlaylistM3U: playlist not found');
        return false;
      }

      const positionDirection = playlist.sort_order === 'reversed' ? 'DESC' : 'ASC';
      const videos = await PlaylistVideo.findAll({
        where: { playlist_id: playlist.playlist_id, ignored: false },
        order: [['position', positionDirection]],
      });

      const outputRoot = configModule.directoryPath;
      const m3uDir = path.join(outputRoot, M3U_FOLDER_NAME);
      fs.mkdirSync(m3uDir, { recursive: true });
      // Keep Jellyfin/Emby from importing these .m3u files as duplicate playlists.
      fs.writeFileSync(path.join(m3uDir, SCANNER_IGNORE_FILE), '', 'utf8');

      const title = playlist.title || playlist.playlist_id;
      const fileName = sanitizeNameLikeYtDlp(title) + M3U_EXTENSION;
      const m3uPath = path.join(m3uDir, fileName);

      const mp3OwnerLine = mp3ListOwnerLine('playlist', playlist.playlist_id);

      // A playlist really titled "<other title> (MP3)" shares its main path with
      // that playlist's MP3 list. Whichever file is there first keeps the name,
      // so a player already using it does not silently change playlists.
      if (fs.existsSync(m3uPath)) {
        const existingOwnerLine = this._readMp3ListOwnerLine(m3uPath);
        if (existingOwnerLine && existingOwnerLine !== mp3OwnerLine) {
          logger.warn({ m3uPath, playlistId }, 'M3U not written: that file is another playlist\'s MP3 list');
          return false;
        }
      }

      const lines = m3uHeader(title);
      const mp3Lines = m3uHeader(`${title}${MP3_LIST_SUFFIX}`, mp3OwnerLine);
      let included = 0;
      let mp3Included = 0;
      for (const pv of videos) {
        const video = await Video.findOne({ where: { youtubeId: pv.youtube_id } });
        // A deleted row keeps its stored paths, but its file is gone for good.
        // A missing one stays listed: its file may come back.
        const paths = video && removalState(video) !== REMOVAL_STATES.DELETED
          ? resolveEntryPaths(video, playlist.audio_format)
          : { main: null, mp3: null };
        if (!paths.main && !paths.mp3) {
          logger.debug({ youtube_id: pv.youtube_id }, 'M3U: skipping un-downloaded video');
          continue;
        }
        const extinf = `#EXTINF:${video.duration || 0},${video.youTubeChannelName || ''} - ${video.youTubeVideoName || pv.youtube_id}`;
        if (paths.main) {
          lines.push(extinf, path.relative(m3uDir, paths.main));
          included += 1;
        }
        if (paths.mp3) {
          mp3Lines.push(extinf, path.relative(m3uDir, paths.mp3));
          mp3Included += 1;
        }
      }

      fs.writeFileSync(m3uPath, lines.join('\n') + '\n', 'utf8');

      const mp3Path = mp3ListPath(m3uPath);
      const mp3Ownership = this._mp3ListOwnership(mp3Path, mp3OwnerLine);
      if (mp3Ownership === OWNERSHIP.FOREIGN) {
        if (mp3Included > 0) {
          logger.warn({ mp3Path, playlistId }, 'M3U: MP3 list skipped, that file was not generated for this playlist');
        }
        mp3Included = 0;
      } else if (mp3Included > 0) {
        fs.writeFileSync(mp3Path, mp3Lines.join('\n') + '\n', 'utf8');
      } else if (mp3Ownership === OWNERSHIP.OWN) {
        fs.unlinkSync(mp3Path);
        logger.info({ mp3Path }, 'M3U: MP3 list removed (no mp3 entries)');
      }

      logger.info({ m3uPath, included, mp3Included, total: videos.length }, 'M3U generated');
      return true;
    } catch (err) {
      logger.error({ err, playlistId }, 'generatePlaylistM3U failed');
      return false;
    }
  }

  /**
   * Whose file sits at an MP3 list's path, judged by its owner line.
   * @param {string} mp3Path
   * @param {string} ownerLine - From mp3ListOwnerLine, for the playlist or channel asking
   * @returns {string} One of OWNERSHIP
   */
  _mp3ListOwnership(mp3Path, ownerLine) {
    if (!fs.existsSync(mp3Path)) return OWNERSHIP.ABSENT;
    return this._readMp3ListOwnerLine(mp3Path) === ownerLine ? OWNERSHIP.OWN : OWNERSHIP.FOREIGN;
  }

  /**
   * @param {string} filePath - An existing .m3u file
   * @returns {string|null} Its MP3 list owner line, or null when it is not a generated MP3 list
   */
  _readMp3ListOwnerLine(filePath) {
    const header = fs.readFileSync(filePath, 'utf8')
      .split('\n', MP3_LIST_HEADER_LINES)
      .map((line) => line.trim());
    return header.find((line) => line.startsWith(MP3_LIST_OWNER_TAG)) || null;
  }

  _removeIfPresent(filePath, logMessage) {
    if (!fs.existsSync(filePath)) return;
    fs.unlinkSync(filePath);
    logger.info({ filePath }, logMessage);
  }

  _channelM3uTargetPath(channel) {
    const baseDir = configModule.directoryPath;
    const subfolder = resolveEffectiveSubfolder(
      channel.sub_folder,
      configModule.getDefaultSubfolder()
    );
    const folderName = resolveChannelFolderName(channel);
    const channelDir = buildChannelPath(baseDir, subfolder, folderName);
    const fileName = `${sanitizeNameLikeYtDlp(folderName)}.m3u`;
    return { channelDir, m3uPath: path.join(channelDir, fileName) };
  }

  /**
   * Write one channel list, or remove its file when it has no entries so no
   * empty playlist is left behind.
   * @param {{ m3uPath: string, channelDir: string, title: string, ownerLine?: string, entries: Array<{ video: Object, mediaPath: string }> }} list
   * @returns {number} Entries written
   */
  _writeChannelList({ m3uPath, channelDir, title, ownerLine = null, entries }) {
    if (entries.length === 0) {
      this._removeIfPresent(m3uPath, 'Channel M3U removed (no playable entries)');
      return 0;
    }

    const lines = m3uHeader(title, ownerLine);
    for (const { video, mediaPath } of entries) {
      lines.push(`#EXTINF:${video.duration || 0},${video.youTubeVideoName || video.youtubeId}`);
      lines.push(path.relative(channelDir, mediaPath));
    }

    fs.mkdirSync(channelDir, { recursive: true });
    // Write-to-temp then rename so a media server scan never observes a
    // half-written playlist.
    const tmpPath = `${m3uPath}.tmp`;
    fs.writeFileSync(tmpPath, lines.join('\n') + '\n', 'utf8');
    fs.renameSync(tmpPath, m3uPath);
    return entries.length;
  }

  generateChannelM3U(channelId) {
    return this._serialized(`channel:${channelId}`, () => this._generateChannelM3U(channelId));
  }

  async _generateChannelM3U(channelId) {
    try {
      const channel = await Channel.findOne({ where: { channel_id: channelId } });
      if (!channel) {
        logger.warn({ channelId }, 'generateChannelM3U: channel not found');
        return false;
      }
      if (!channel.m3u_enabled || !channel.enabled) {
        return false;
      }
      if (!resolveChannelFolderName(channel)) {
        logger.warn({ channelId }, 'generateChannelM3U: channel has no folder name');
        return false;
      }

      const direction = channel.m3u_sort_order === 'newest_first' ? 'DESC' : 'ASC';
      const videos = await Video.findAll({
        where: { channel_id: channelId, removed: false },
        attributes: ['youtubeId', 'filePath', 'audioFilePath', 'duration', 'youTubeVideoName'],
        order: [['originalDate', direction], ['id', direction]],
      });

      const { channelDir, m3uPath } = this._channelM3uTargetPath(channel);

      // Mirror the playlist generator's choice of file per item.
      const candidates = [];
      for (const video of videos) {
        const paths = resolveEntryPaths(video, channel.audio_format);
        if (paths.main) candidates.push({ video, mediaPath: paths.main, isMp3List: false });
        if (paths.mp3) candidates.push({ video, mediaPath: paths.mp3, isMp3List: true });
      }

      // Files deleted outside Youtarr drop out here without waiting on a rescan.
      const existence = [];
      for (let i = 0; i < candidates.length; i += FILE_EXISTENCE_CHECK_CONCURRENCY) {
        const chunk = candidates.slice(i, i + FILE_EXISTENCE_CHECK_CONCURRENCY);
        existence.push(...await Promise.all(chunk.map((c) => fileExists(c.mediaPath))));
      }

      const onDisk = candidates.filter(({ video, mediaPath }, i) => {
        if (!existence[i]) {
          logger.debug({ youtubeId: video.youtubeId, mediaPath }, 'Channel M3U: skipping missing file');
        }
        return existence[i];
      });

      const title = channel.title || channel.uploader || channelId;
      const included = this._writeChannelList({
        m3uPath,
        channelDir,
        title,
        entries: onDisk.filter((c) => !c.isMp3List),
      });

      const mp3Path = mp3ListPath(m3uPath);
      const mp3OwnerLine = mp3ListOwnerLine('channel', channel.channel_id);
      const mp3Entries = onDisk.filter((c) => c.isMp3List);
      let mp3Included = 0;
      if (this._mp3ListOwnership(mp3Path, mp3OwnerLine) === OWNERSHIP.FOREIGN) {
        if (mp3Entries.length > 0) {
          logger.warn({ mp3Path, channelId }, 'Channel M3U: MP3 list skipped, that file was not generated for this channel');
        }
      } else {
        // Outside Video + MP3 this list is empty, which removes a leftover file.
        mp3Included = this._writeChannelList({
          m3uPath: mp3Path,
          channelDir,
          title: `${title}${MP3_LIST_SUFFIX}`,
          ownerLine: mp3OwnerLine,
          entries: mp3Entries,
        });
      }
      logger.info({ m3uPath, included, mp3Included, total: videos.length }, 'Channel M3U generated');
      return true;
    } catch (err) {
      logger.error({ err, channelId }, 'generateChannelM3U failed');
      return false;
    }
  }

  deleteChannelM3U(channelId) {
    // Queued behind any rebuild in flight, which would otherwise put the files back.
    return this._serialized(`channel:${channelId}`, () => this._deleteChannelM3U(channelId));
  }

  async _deleteChannelM3U(channelId) {
    try {
      const channel = await Channel.findOne({ where: { channel_id: channelId } });
      if (!channel || !resolveChannelFolderName(channel)) {
        return false;
      }
      const { m3uPath } = this._channelM3uTargetPath(channel);
      if (fs.existsSync(m3uPath)) {
        fs.unlinkSync(m3uPath);
        logger.info({ m3uPath }, 'Channel M3U deleted');
      }
      const mp3Path = mp3ListPath(m3uPath);
      const mp3OwnerLine = mp3ListOwnerLine('channel', channel.channel_id);
      if (this._mp3ListOwnership(mp3Path, mp3OwnerLine) === OWNERSHIP.OWN) {
        fs.unlinkSync(mp3Path);
        logger.info({ mp3Path }, 'Channel MP3 M3U deleted');
      }
      return true;
    } catch (err) {
      logger.error({ err, channelId }, 'deleteChannelM3U failed');
      return false;
    }
  }

  /**
   * Fire-and-forget channel .m3u regeneration for callers whose own operation
   * must never fail because of an m3u problem. generateChannelM3U guards
   * m3u_enabled/enabled itself, so this is safe to call unconditionally.
   * @param {string} channelId
   * @param {string} context - Caller label for the error log (e.g. 'download-completion')
   */
  generateChannelM3UInBackground(channelId, context) {
    this.generateChannelM3U(channelId).catch((err) => {
      logger.error({ err, channelId, context }, 'Failed to regenerate channel M3U');
    });
  }

  /**
   * Fire-and-forget counterpart of deleteChannelM3U.
   * @param {string} channelId
   * @param {string} context - Caller label for the error log
   */
  deleteChannelM3UInBackground(channelId, context) {
    this.deleteChannelM3U(channelId).catch((err) => {
      logger.error({ err, channelId, context }, 'Failed to delete channel M3U');
    });
  }

  async regenerateAllChannelM3Us() {
    try {
      const channels = await Channel.findAll({
        where: { m3u_enabled: true, enabled: true },
      });
      let succeeded = 0;
      for (const channel of channels) {
        const ok = await this.generateChannelM3U(channel.channel_id);
        if (ok) succeeded += 1;
      }
      if (channels.length > 0) {
        logger.info({ attempted: channels.length, succeeded }, 'Channel M3U sweep complete');
      }
      return { attempted: channels.length, succeeded };
    } catch (err) {
      logger.error({ err }, 'regenerateAllChannelM3Us failed');
      return { attempted: 0, succeeded: 0 };
    }
  }
}

module.exports = new M3uGenerator();
