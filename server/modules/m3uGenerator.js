const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const { Playlist, PlaylistVideo, Video } = require('../models');
const { sanitizeNameLikeYtDlp } = require('./filesystem/sanitizer');
const configModule = require('./configModule');

const M3U_FOLDER_NAME = '__playlists__';

class M3uGenerator {
  async generatePlaylistM3U(playlistId) {
    try {
      const playlist = await Playlist.findByPk(playlistId);
      if (!playlist) {
        logger.warn({ playlistId }, 'generatePlaylistM3U: playlist not found');
        return false;
      }

      const videos = await PlaylistVideo.findAll({
        where: { playlist_id: playlist.playlist_id, ignored: false },
        order: [['position', 'ASC']],
      });

      const outputRoot = configModule.directoryPath;
      const m3uDir = path.join(outputRoot, M3U_FOLDER_NAME);
      fs.mkdirSync(m3uDir, { recursive: true });

      const title = playlist.title || playlist.playlist_id;
      const fileName = sanitizeNameLikeYtDlp(title) + '.m3u';
      const m3uPath = path.join(m3uDir, fileName);

      const lines = ['#EXTM3U', `#PLAYLIST:${title}`];
      let included = 0;
      for (const pv of videos) {
        const video = await Video.findOne({ where: { youtubeId: pv.youtube_id } });
        if (!video || !video.filePath) {
          logger.debug({ youtube_id: pv.youtube_id }, 'M3U: skipping un-downloaded video');
          continue;
        }
        const relPath = path.relative(m3uDir, video.filePath);
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
}

module.exports = new M3uGenerator();
