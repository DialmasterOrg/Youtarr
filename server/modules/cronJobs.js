const schedule = require('node-cron');
const logger = require('../logger');

/**
 * Initialize all scheduled cron jobs for the application
 * This module centralizes all cron job definitions for better maintainability
 *
 * @param {Object} [deps]
 * @param {Function} [deps.refreshYtDlpVersionCache] - Refreshes the cached yt-dlp version after a successful auto-update
 */
function initialize(deps = {}) {
  const db = require('../db');
  const videosModule = require('./videosModule');
  const videoDeletionModule = require('./videoDeletionModule');
  const notificationModule = require('./notificationModule');
  const ytdlpModule = require('./ytdlpModule');
  const configModule = require('./configModule');
  const { refreshYtDlpVersionCache } = deps;

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

        notificationModule.sendAutoRemovalNotification(result)
          .catch(err => logger.error({ err }, 'Failed to send auto-removal notification'));
      } else {
        logger.info('Automatic cleanup completed: no videos deleted');
      }

      if (result.errors.length > 0) {
        logger.warn({ errorCount: result.errors.length }, 'Automatic cleanup completed with errors');
      }
    } catch (error) {
      logger.error({ err: error }, 'Error during automatic video cleanup');
    }

    // Always scan for orphan empty channel directories, regardless of auto-removal settings.
    // This handles directories left behind from deletions before the cleanup feature existed,
    // or from files deleted outside of Youtarr.
    try {
      await videoDeletionModule.cleanupOrphanDirectories();
    } catch (error) {
      logger.error({ err: error }, 'Error during orphan directory cleanup');
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

  // ============================================================================
  // YT-DLP AUTO-UPDATE - 4:00 AM Daily (only when enabled in config)
  // ============================================================================
  schedule.schedule('0 4 * * *', async () => {
    try {
      // Skip on platforms that manage yt-dlp themselves (e.g., Elfhosted)
      if (configModule.isElfhostedPlatform()) {
        return;
      }

      const config = configModule.getConfig();
      if (!config.autoUpdateYtdlp) {
        return;
      }

      logger.info('Running nightly yt-dlp auto-update');
      const checkedAt = new Date().toISOString();
      const result = await ytdlpModule.performUpdate();

      const updatedConfig = { ...configModule.getConfig(), ytdlpLastChecked: checkedAt };

      const resultStatus = result.reason || (result.success ? (result.newVersion ? 'updated' : 'up-to-date') : 'error');

      if (result.success) {
        if (resultStatus === 'updated') {
          updatedConfig.ytdlpLastUpdated = checkedAt;
          updatedConfig.ytdlpLastResult = {
            status: 'updated',
            ...(result.newVersion ? { version: result.newVersion } : {})
          };
          logger.info({ newVersion: result.newVersion }, 'Nightly yt-dlp auto-update installed new version');
        } else {
          updatedConfig.ytdlpLastResult = { status: 'up-to-date' };
          logger.info('Nightly yt-dlp auto-update: already up to date');
        }
        if (typeof refreshYtDlpVersionCache === 'function') {
          try {
            refreshYtDlpVersionCache();
          } catch (err) {
            logger.warn({ err }, 'Failed to refresh yt-dlp version cache after auto-update');
          }
        }
      } else {
        updatedConfig.ytdlpLastResult = {
          status: resultStatus === 'skipped' ? 'skipped' : 'error',
          message: result.message || 'Unknown error'
        };
        if (resultStatus === 'skipped') {
          logger.info({ message: result.message }, 'Nightly yt-dlp auto-update skipped');
        } else {
          logger.warn({ message: result.message }, 'Nightly yt-dlp auto-update failed');
        }
      }

      configModule.updateConfig(updatedConfig);
    } catch (error) {
      logger.error({ err: error }, 'Unexpected error in nightly yt-dlp auto-update');
    }
  });

  logger.info('Scheduled cron jobs initialized successfully');
  logger.info('  - Automatic video cleanup: 2:00 AM daily');
  logger.info('  - Session cleanup: 3:00 AM daily');
  logger.info('  - Video metadata backfill: 3:30 AM daily');
  logger.info('  - yt-dlp auto-update: 4:00 AM daily (when enabled)');
}

module.exports = {
  initialize
};
