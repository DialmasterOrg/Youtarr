'use strict';

const ratingMapper = require('../server/modules/ratingMapper');
const ytDlpRunner = require('../server/modules/ytDlpRunner');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // This migration automatically backfills ratings for existing videos
    // It's safe to run multiple times (idempotent)
    
    console.log('[Migration] Starting automatic rating backfill...');
    
    try {
      // Find videos with null normalized_rating (not yet processed)
      const videosToUpdate = await queryInterface.sequelize.query(
        `SELECT id, youtubeId, youTubeVideoName FROM Videos WHERE normalized_rating IS NULL LIMIT 100`,
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
          // Fetch metadata using yt-dlp
          const videoUrl = `https://www.youtube.com/watch?v=${video.youtubeId}`;
          
          let metadata = null;
          try {
            metadata = await ytDlpRunner.fetchMetadata(videoUrl, 30000);
          } catch (err) {
            console.warn(`[Migration] Failed to fetch metadata for ${video.youtubeId}: ${err.message}`);
            failed++;
            
            // Mark as attempted but failed
            await queryInterface.sequelize.query(
              `UPDATE Videos SET rating_source = 'backfill-failed' WHERE id = ?`,
              { replacements: [video.id] }
            );
            continue;
          }

          if (!metadata) {
            console.warn(`[Migration] No metadata for ${video.youtubeId}`);
            failed++;
            continue;
          }

          // Extract rating information
          const contentRating = metadata.contentRating || metadata.content_rating || null;
          const ageLimit = metadata.age_limit || null;
          const ratingInfo = ratingMapper.mapFromEntry(contentRating, ageLimit);

          if (ratingInfo.normalized_rating) {
            // Update the video with rating information
            await queryInterface.sequelize.query(
              `UPDATE Videos 
               SET content_rating = ?, age_limit = ?, normalized_rating = ?, rating_source = ?
               WHERE id = ?`,
              {
                replacements: [
                  contentRating ? JSON.stringify(contentRating) : null,
                  ageLimit,
                  ratingInfo.normalized_rating,
                  ratingInfo.source,
                  video.id
                ]
              }
            );
            
            console.log(`[Migration] ✓ ${video.youtubeId} -> ${ratingInfo.normalized_rating}`);
            processed++;
          } else {
            console.log(`[Migration] ○ ${video.youtubeId} (no rating data available)`);
            
            // Mark as attempted with no rating
            await queryInterface.sequelize.query(
              `UPDATE Videos SET rating_source = 'backfill-no-rating' WHERE id = ?`,
              { replacements: [video.id] }
            );
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));

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
      // Don't fail the migration - backfill is optional and can be run manually
      console.log('[Migration] Continuing without backfill - you can run it manually later');
    }
  },

  async down(queryInterface, Sequelize) {
    // Backfill is idempotent, so no down action needed
    // Ratings will remain in the database (which is fine)
    console.log('[Migration] Rating backfill is idempotent - down migration skips cleanup');
  }
};
