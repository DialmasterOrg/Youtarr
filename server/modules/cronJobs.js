const schedule = require('node-cron');
const logger = require('../logger');

/**
 * Initialize all scheduled cron jobs for the application
 * This module centralizes all cron job definitions for better maintainability
 */
function initialize() {
  const db = require('../db');
  const videosModule = require('./videosModule');
  const videoDeletionModule = require('./videoDeletionModule');

  logger.info('Initializing scheduled cron jobs');

  // ============================================================================
  // AUTOMATIC VIDEO CLEANUP - 2:00 AM Daily
  // ============================================================================
  schedule.schedule('0 2 * * *', async () => {
    logger.info('Running automatic video cleanup cron job');
    try {
      const result = await videoDeletionModule.performAutomaticCleanup();

      if (result.totalDeleted > 0) {
        logger.info({
          totalDeleted: result.totalDeleted,
          freedGB: (result.freedBytes / (1024 ** 3)).toFixed(2)
        }, 'Automatic cleanup completed successfully');
      } else {
        logger.info('Automatic cleanup completed: no videos deleted');
      }

      if (result.errors.length > 0) {
        logger.warn({ errorCount: result.errors.length }, 'Automatic cleanup completed with errors');
      }
    } catch (error) {
      logger.error({ err: error }, 'Error during automatic video cleanup');
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
      logger.info({ removed: result }, 'Removed expired sessions');
    } catch (error) {
      logger.error({ err: error }, 'Error cleaning sessions');
    }
  });

  // ============================================================================
  // VIDEO METADATA BACKFILL - 3:30 AM Daily
  // ============================================================================
  schedule.schedule('30 3 * * *', async () => {
    logger.info('Starting scheduled video metadata backfill');
    try {
      // Run asynchronously without blocking - the method handles its own async flow
      videosModule.backfillVideoMetadata()
        .then(result => {
          if (result && result.timedOut) {
            logger.info('Video metadata backfill reached time limit, will continue tomorrow');
          } else {
            logger.info('Video metadata backfill completed successfully');
          }
        })
        .catch(err => {
          logger.error({ err }, 'Video metadata backfill failed');
        });
    } catch (error) {
      logger.error({ err: error }, 'Error starting video metadata backfill');
    }
  });

  logger.info('Scheduled cron jobs initialized successfully');
  logger.info('  - Automatic video cleanup: 2:00 AM daily');
  logger.info('  - Session cleanup: 3:00 AM daily');
  logger.info('  - Video metadata backfill: 3:30 AM daily');
}

module.exports = {
  initialize
};
