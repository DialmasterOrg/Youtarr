'use strict';

const ratingMapper = require('../server/modules/ratingMapper');
const ytDlpRunner = require('../server/modules/ytDlpRunner');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    console.log('[Migration] Starting automatic rating backfill...');

    try {
      const videosToUpdate = await queryInterface.sequelize.query(
        'SELECT id, youtubeId, youTubeVideoName FROM Videos WHERE normalized_rating IS NULL LIMIT 100',
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );

      if (videosToUpdate.length === 0) {
        console.log('[Migration] No videos to backfill (all already have ratings or none present)');
        return;
      }

      console.log(`[Migration] Found ${videosToUpdate.length} videos to backfill (processing first 100)`);
      let processed = 0;
      let failed = 0;

      for (const video of videosToUpdate) {
        try {
          const videoUrl = `https://www.youtube.com/watch?v=${video.youtubeId}`;

          let metadata = null;
          try {
            metadata = await ytDlpRunner.fetchMetadata(videoUrl, 30000);
          } catch (err) {
            console.warn(`[Migration] Failed to fetch metadata for ${video.youtubeId}: ${err.message}`);
            failed++;

            await queryInterface.sequelize.query(
              'UPDATE Videos SET rating_source = ? WHERE id = ?',
              { replacements: ['backfill-failed', video.id] }
            );
            continue;
          }

          if (!metadata) {
            console.warn(`[Migration] No metadata for ${video.youtubeId}`);
            failed++;
            continue;
          }

          const contentRating = metadata.contentRating || metadata.content_rating || null;
          const ageLimit = metadata.age_limit || null;
          const ratingInfo = ratingMapper.mapFromEntry(contentRating, ageLimit);

          if (ratingInfo.normalized_rating) {
            await queryInterface.sequelize.query(
              'UPDATE Videos SET content_rating = ?, age_limit = ?, normalized_rating = ?, rating_source = ? WHERE id = ?',
              {
                replacements: [
                  contentRating ? JSON.stringify(contentRating) : null,
                  ageLimit,
                  ratingInfo.normalized_rating,
                  ratingInfo.source,
                  video.id,
                ],
              }
            );

            console.log(`[Migration] ✓ ${video.youtubeId} -> ${ratingInfo.normalized_rating}`);
            processed++;
          } else {
            console.log(`[Migration] ○ ${video.youtubeId} (no rating data available)`);
            await queryInterface.sequelize.query(
              'UPDATE Videos SET rating_source = ? WHERE id = ?',
              { replacements: ['backfill-no-rating', video.id] }
            );
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (err) {
          console.error(`[Migration] Error processing ${video.youtubeId}: ${err.message}`);
          failed++;
        }
      }

      console.log(`[Migration] Backfill complete: ${processed} processed, ${failed} failed`);
      console.log('[Migration] Note: If you have many videos, some may not have been processed in this migration.');
      console.log('[Migration] You can run the standalone backfill script for full coverage: node scripts/backfill-ratings.js');
    } catch (err) {
      console.error('[Migration] Backfill error:', err.message);
      console.log('[Migration] Continuing without backfill - you can run it manually later');
    }
  },

  async down() {
    console.log('[Migration] Rating backfill is idempotent - down migration skips cleanup');
  }
};
