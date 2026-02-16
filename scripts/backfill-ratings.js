#!/usr/bin/env node

/**
 * Backfill script to populate rating fields for existing videos
 *
 * Usage:
 *   node scripts/backfill-ratings.js --dry-run
 *   node scripts/backfill-ratings.js
 */

const path = require('path');
const fs = require('fs-extra');
const { sequelize } = require('../server/db');
const Video = require('../server/models/video');
const ratingMapper = require('../server/modules/ratingMapper');
const ytDlpRunner = require('../server/modules/ytDlpRunner');
const logger = require('../server/logger');

const BATCH_SIZE = 10;
const RATE_LIMIT_DELAY_MS = 500;

let videoProcessed = 0;
let videoSkipped = 0;
let videoFailed = 0;

const isDryRun = process.argv.includes('--dry-run');
const logFilePath = path.join(__dirname, `backfill-ratings-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

function writeLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(logFilePath, logMessage + '\n');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function backfillVideoRatings() {
  try {
    writeLog('=== Starting Rating Backfill ===');
    writeLog(`Dry Run Mode: ${isDryRun ? 'YES' : 'NO'}`);
    writeLog(`Log File: ${logFilePath}`);

    const videosToUpdate = await Video.findAll({
      where: { normalized_rating: null },
      attributes: ['id', 'youtubeId', 'youTubeVideoName', 'content_rating', 'age_limit', 'normalized_rating'],
      raw: true,
    });

    const total = videosToUpdate.length;
    writeLog(`Found ${total} videos to backfill`);

    if (total === 0) {
      writeLog('No videos to backfill. Exiting.');
      return;
    }

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = videosToUpdate.slice(i, Math.min(i + BATCH_SIZE, total));
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(total / BATCH_SIZE);

      writeLog(`\nProcessing Batch ${batchNumber}/${totalBatches} (${batch.length} videos)`);

      for (const video of batch) {
        try {
          if (video.normalized_rating) {
            writeLog(`  SKIP: ${video.youtubeId} - already has rating`);
            videoSkipped++;
            continue;
          }

          writeLog(`  Fetching: ${video.youtubeId} - ${video.youTubeVideoName}`);

          let metadata = null;
          try {
            const videoUrl = `https://www.youtube.com/watch?v=${video.youtubeId}`;
            metadata = await ytDlpRunner.fetchMetadata(videoUrl, 30000);
          } catch (err) {
            writeLog(`    ERROR fetching metadata: ${err.message}`);
            videoFailed++;
            if (!isDryRun) {
              await Video.update(
                { rating_source: 'backfill-failed' },
                { where: { id: video.id } }
              );
            }
            continue;
          }

          if (!metadata) {
            writeLog('    ERROR: No metadata returned');
            videoFailed++;
            continue;
          }

          const contentRating = metadata.contentRating || metadata.content_rating || null;
          const ageLimit = metadata.age_limit || null;
          const ratingInfo = ratingMapper.mapFromEntry(contentRating, ageLimit);

          if (ratingInfo.normalized_rating) {
            writeLog(`    SUCCESS: ${video.youtubeId} -> ${ratingInfo.normalized_rating} (${ratingInfo.source})`);
            if (!isDryRun) {
              await Video.update(
                {
                  content_rating: contentRating,
                  age_limit: ageLimit,
                  normalized_rating: ratingInfo.normalized_rating,
                  rating_source: ratingInfo.source,
                },
                { where: { id: video.id } }
              );
            }
            videoProcessed++;
          } else {
            writeLog(`    NO RATING: ${video.youtubeId} - no rating data available`);
            videoSkipped++;
            if (!isDryRun) {
              await Video.update(
                { rating_source: 'backfill-no-rating' },
                { where: { id: video.id } }
              );
            }
          }

          await sleep(RATE_LIMIT_DELAY_MS);
        } catch (err) {
          logger.error({ err }, 'Backfill rating exception');
          writeLog(`  EXCEPTION processing ${video.youtubeId}: ${err.message}`);
          videoFailed++;
        }
      }

      writeLog(`Batch ${batchNumber} complete. Progress: ${Math.min(i + BATCH_SIZE, total)}/${total}`);
    }

    writeLog('\n=== Backfill Complete ===');
    writeLog(`Videos Processed: ${videoProcessed}`);
    writeLog(`Videos Skipped: ${videoSkipped}`);
    writeLog(`Videos Failed: ${videoFailed}`);
    writeLog(`Success Rate: ${((videoProcessed / total) * 100).toFixed(1)}%`);

    if (isDryRun) {
      writeLog('DRY RUN: No changes were made to the database');
    }
  } catch (err) {
    writeLog(`FATAL ERROR: ${err.message}`);
    writeLog(err.stack);
    process.exit(1);
  } finally {
    if (sequelize) {
      await sequelize.close();
    }
    process.exit(0);
  }
}

backfillVideoRatings().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
