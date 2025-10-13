const schedule = require('node-cron');

/**
 * Initialize all scheduled cron jobs for the application
 * This module centralizes all cron job definitions for better maintainability
 */
function initialize() {
  const db = require('../db');
  const videosModule = require('./videosModule');
  const videoDeletionModule = require('./videoDeletionModule');

  console.log('[CronJobs] Initializing scheduled tasks...');

  // ============================================================================
  // AUTOMATIC VIDEO CLEANUP - 2:00 AM Daily
  // ============================================================================
  schedule.schedule('0 2 * * *', async () => {
    console.log('[CRON] Running automatic video cleanup at 2:00 AM...');
    try {
      const result = await videoDeletionModule.performAutomaticCleanup();

      if (result.totalDeleted > 0) {
        console.log(`[CRON] Automatic cleanup completed: ${result.totalDeleted} videos deleted, ${(result.freedBytes / (1024 ** 3)).toFixed(2)} GB freed`);
      } else {
        console.log('[CRON] Automatic cleanup completed: no videos deleted');
      }

      if (result.errors.length > 0) {
        console.warn(`[CRON] Automatic cleanup completed with ${result.errors.length} errors`);
      }
    } catch (error) {
      console.error('[CRON] Error during automatic video cleanup:', error);
    }
  });

  // ============================================================================
  // SESSION CLEANUP - 3:00 AM Daily
  // ============================================================================
  schedule.schedule('0 3 * * *', async () => {
    try {
      const result = await db.Session.destroy({
        where: {
          [db.Sequelize.Op.or]: [
            {
              expires_at: {
                [db.Sequelize.Op.lt]: new Date()
              }
            },
            {
              is_active: false,
              updatedAt: {
                [db.Sequelize.Op.lt]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days old
              }
            }
          ]
        }
      });
      console.log(`[CLEANUP] Removed ${result} expired sessions`);
    } catch (error) {
      console.error('[CLEANUP] Error cleaning sessions:', error);
    }
  });

  // ============================================================================
  // VIDEO METADATA BACKFILL - 3:30 AM Daily
  // ============================================================================
  schedule.schedule('30 3 * * *', async () => {
    console.log('[CRON] Starting scheduled video metadata backfill at 3:30 AM...');
    try {
      // Run asynchronously without blocking - the method handles its own async flow
      videosModule.backfillVideoMetadata()
        .then(result => {
          if (result && result.timedOut) {
            console.log('[CRON] Video metadata backfill reached time limit, will continue tomorrow');
          } else {
            console.log('[CRON] Video metadata backfill completed successfully');
          }
        })
        .catch(err => {
          console.error('[CRON] Video metadata backfill failed:', err);
        });
    } catch (error) {
      console.error('[CRON] Error starting video metadata backfill:', error);
    }
  });

  console.log('[CronJobs] Scheduled tasks initialized:');
  console.log('  - Automatic video cleanup: 2:00 AM daily');
  console.log('  - Session cleanup: 3:00 AM daily');
  console.log('  - Video metadata backfill: 3:30 AM daily');
}

module.exports = {
  initialize
};
