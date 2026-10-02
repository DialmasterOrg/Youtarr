const { Video } = require('../models');
const logger = require('../logger');

// Bytes a video row occupies on disk: its video file plus any MP3 copy.
// Audio-only downloads have a NULL file_size, so both columns count.
const STORED_BYTES_SQL = '(COALESCE(Video.file_size, 0) + COALESCE(Video.audio_file_size, 0))';

// Read side of "how much space do Youtarr's downloads use", measured from the
// sizes recorded at download time and corrected by the nightly rescan rather
// than by walking the output directory, which is slow on network and cloud
// mounts. Sidecar files (thumbnails, .info.json, NFO, subtitles) are not counted.
class StorageUsage {
  /**
   * Total bytes of every downloaded video not marked removed.
   * Errors propagate so callers choose whether to fail open or closed.
   * @returns {Promise<number>}
   */
  async getDownloadedBytes() {
    const { sequelize } = require('../db.js');

    try {
      const result = await Video.findOne({
        attributes: [
          [
            sequelize.fn(
              'COALESCE',
              sequelize.fn('SUM', sequelize.literal(STORED_BYTES_SQL)),
              0,
            ),
            'totalBytes',
          ],
        ],
        where: {
          removed: false,
        },
        raw: true,
      });
      const total = Number(result?.totalBytes ?? 0);
      return Number.isFinite(total) ? total : 0;
    } catch (error) {
      logger.error({ err: error }, 'Error summing downloaded video sizes');
      throw error;
    }
  }
}

module.exports = new StorageUsage();
module.exports.STORED_BYTES_SQL = STORED_BYTES_SQL;
