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

const M3U_FOLDER_NAME = '__playlists__';
// Empty marker file that tells the Jellyfin and Emby library scanners to skip
// this folder. Without it, those servers auto-import the .m3u files as duplicate
// (and on Jellyfin, empty) playlists alongside the ones created via native API
// sync. Both servers honor a file literally named ".ignore".
const SCANNER_IGNORE_FILE = '.ignore';
// Keeps large channels fast without flooding slow SMB/NAS mounts.
const FILE_EXISTENCE_CHECK_CONCURRENCY = 25;

async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

class M3uGenerator {
  async generatePlaylistM3U(playlistId) {
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
      const fileName = sanitizeNameLikeYtDlp(title) + '.m3u';
      const m3uPath = path.join(m3uDir, fileName);

      // One entry per item: MP3 Only playlists prefer the mp3, everything else
      // the video, falling back to the other file so nothing is dropped.
      const preferAudio = playlist.audio_format === 'mp3_only';

      const lines = ['#EXTM3U', `#PLAYLIST:${title}`];
      let included = 0;
      for (const pv of videos) {
        const video = await Video.findOne({ where: { youtubeId: pv.youtube_id } });
        const mediaPath = video && (preferAudio
          ? (video.audioFilePath || video.filePath)
          : (video.filePath || video.audioFilePath));
        if (!mediaPath) {
          logger.debug({ youtube_id: pv.youtube_id }, 'M3U: skipping un-downloaded video');
          continue;
        }
        const relPath = path.relative(m3uDir, mediaPath);
        const label = `${video.youTubeChannelName || ''} - ${video.youTubeVideoName || pv.youtube_id}`;
        lines.push(`#EXTINF:${video.duration || 0},${label}`);
        lines.push(relPath);
        included += 1;
      }

      fs.writeFileSync(m3uPath, lines.join('\n') + '\n', 'utf8');
      logger.info({ m3uPath, included, total: videos.length }, 'M3U generated');
      return true;
    } catch (err) {
      logger.error({ err, playlistId }, 'generatePlaylistM3U failed');
      return false;
    }
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

  async generateChannelM3U(channelId) {
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

      // Mirror the playlist generator: mp3-only channels prefer the mp3,
      // everything else the video, falling back so nothing downloaded is dropped.
      const preferAudio = channel.audio_format === 'mp3_only';
      const candidates = [];
      for (const video of videos) {
        const mediaPath = preferAudio
          ? (video.audioFilePath || video.filePath)
          : (video.filePath || video.audioFilePath);
        if (mediaPath) candidates.push({ video, mediaPath });
      }

      // Files deleted outside Youtarr drop out here without waiting on a rescan.
      const existence = [];
      for (let i = 0; i < candidates.length; i += FILE_EXISTENCE_CHECK_CONCURRENCY) {
        const chunk = candidates.slice(i, i + FILE_EXISTENCE_CHECK_CONCURRENCY);
        existence.push(...await Promise.all(chunk.map((c) => fileExists(c.mediaPath))));
      }

      const title = channel.title || channel.uploader || channelId;
      const lines = ['#EXTM3U', `#PLAYLIST:${title}`];
      let included = 0;
      candidates.forEach(({ video, mediaPath }, i) => {
        if (!existence[i]) {
          logger.debug({ youtubeId: video.youtubeId, mediaPath }, 'Channel M3U: skipping missing file');
          return;
        }
        lines.push(`#EXTINF:${video.duration || 0},${video.youTubeVideoName || video.youtubeId}`);
        lines.push(path.relative(channelDir, mediaPath));
        included += 1;
      });

      if (included === 0) {
        if (fs.existsSync(m3uPath)) {
          fs.unlinkSync(m3uPath);
          logger.info({ m3uPath }, 'Channel M3U removed (no playable entries)');
        }
        return true;
      }

      fs.mkdirSync(channelDir, { recursive: true });
      // Write-to-temp then rename so a media server scan never observes a
      // half-written playlist.
      const tmpPath = `${m3uPath}.tmp`;
      fs.writeFileSync(tmpPath, lines.join('\n') + '\n', 'utf8');
      fs.renameSync(tmpPath, m3uPath);
      logger.info({ m3uPath, included, total: videos.length }, 'Channel M3U generated');
      return true;
    } catch (err) {
      logger.error({ err, channelId }, 'generateChannelM3U failed');
      return false;
    }
  }

  async deleteChannelM3U(channelId) {
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
