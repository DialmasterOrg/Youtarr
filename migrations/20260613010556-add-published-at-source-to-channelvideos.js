'use strict';

const { addColumnIfMissing, removeColumnIfExists, columnExists } = require('./helpers');

/**
 * Adds channelvideos.published_at_source to track the provenance of
 * publishedAt values:
 *   - 'exact':       from a downloaded video's .info.json (authoritative)
 *   - 'approximate': from yt-dlp's youtubetab:approximate_date flat-playlist
 *                    extraction (rounded to day/hour granularity)
 *   - 'estimated':   an ordering-only placeholder assigned when YouTube
 *                    served a degraded response with no dates at all; never
 *                    shown to users
 *   - NULL:          legacy rows written before this column existed; treated
 *                    like 'approximate'
 *
 * Also repairs legacy data in place:
 *   1. Rows for downloaded videos get the accurate date from
 *      Videos.originalDate and become 'exact'.
 *   2. Remaining rows whose publishedAt has sub-hour precision are marked
 *      'estimated'. Real dates in this table are always rounded (midnight
 *      for day granularity, on-the-hour for recent uploads), while the old
 *      synthetic fallback stamped `Date.now() - index` values with arbitrary
 *      seconds/milliseconds, so non-round values are synthetic garbage from
 *      date-less YouTube responses. Rare false positives (e.g. a fresh
 *      upload dated at minute granularity) only hide the date until the next
 *      channel refresh restores it.
 *
 * The data repair is intentionally not reversed in down(): the overwritten
 * synthetic values were meaningless, and restoring them would reintroduce
 * the bug this migration fixes.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface, 'channelvideos', 'published_at_source', {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: null
    });

    const videosTableHasOriginalDate = await columnExists(queryInterface, 'Videos', 'originalDate');
    if (videosTableHasOriginalDate) {
      await queryInterface.sequelize.query(`
        UPDATE channelvideos cv
        JOIN Videos v ON v.youtubeId = cv.youtube_id
        SET cv.publishedAt = CONCAT(
              SUBSTRING(v.originalDate, 1, 4), '-',
              SUBSTRING(v.originalDate, 5, 2), '-',
              SUBSTRING(v.originalDate, 7, 2), 'T00:00:00.000Z'
            ),
            cv.published_at_source = 'exact'
        WHERE v.originalDate IS NOT NULL
          AND CHAR_LENGTH(v.originalDate) = 8
      `);
    }

    await queryInterface.sequelize.query(`
      UPDATE channelvideos
      SET published_at_source = 'estimated'
      WHERE published_at_source IS NULL
        AND publishedAt IS NOT NULL
        AND publishedAt NOT LIKE '%:00:00.000Z'
    `);
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'channelvideos', 'published_at_source');
  }
};
