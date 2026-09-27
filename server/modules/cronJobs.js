const scheduledTasks = require('./scheduledTaskManager');
const { getSchedule } = require('./scheduleConfig');
const rescanRunSummary = require('./rescanRunSummary');
const ytdlpUpdateRunSummary = require('./ytdlpUpdateRunSummary');
const logger = require('../logger');

const BYTES_PER_GB = 1024 ** 3;
const INACTIVE_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

let initialized = false;

function failedRun(error, outcome = 'error') {
  return { status: 'error', outcome, message: error.message || 'Unknown error' };
}

function skippedRun(message) {
  return { status: 'skipped', outcome: 'skipped', message };
}

const NO_ORPHAN_RESULT = { removed: [], errors: [] };

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

// A run with any failed deletion or folder removal is a partial failure: the
// counts still describe what happened, but the run isn't called a success.
function describeCleanup(result, orphans) {
  const errorCount = result.errors.length + orphans.errors.length;
  const base = result.totalDeleted > 0
    ? `Deleted ${result.totalDeleted} videos and freed ${(result.freedBytes / BYTES_PER_GB).toFixed(2)} GB`
    : 'No videos matched the removal rules';
  const folders = orphans.removed.length > 0 ? `, removed ${plural(orphans.removed.length, 'empty folder')}` : '';
  const suffix = errorCount > 0 ? `; ${plural(errorCount, 'error')}.` : '.';
  return {
    status: errorCount > 0 ? 'error' : 'success',
    outcome: errorCount > 0 ? 'partial' : 'completed',
    message: `${base}${folders}${suffix}`,
    details: {
      deleted: result.totalDeleted,
      freedBytes: result.freedBytes,
      emptyFoldersRemoved: orphans.removed.length,
      errors: errorCount,
    },
  };
}

/**
 * Initialize all scheduled cron jobs for the application
 * This module centralizes all cron job definitions for better maintainability
 *
 * Each job resolves to a run summary ({ status, outcome, message, details })
 * that the scheduler records in the run history.
 *
 * @param {Object} [deps]
 * @param {Function} [deps.refreshYtDlpVersionCache] - Refreshes the cached yt-dlp version after a successful auto-update
 */
function initialize(deps = {}) {
  if (initialized) return;
  const db = require('../db');
  const videosModule = require('./videosModule');
  const videoDeletionModule = require('./videoDeletionModule');
  const notificationModule = require('./notificationModule');
  const ytdlpModule = require('./ytdlpModule');
  const configModule = require('./configModule');
  const tabVideoCounts = require('./channel/tabVideoCounts');
  const { refreshYtDlpVersionCache } = deps;

  logger.info('Initializing scheduled cron jobs');
  const jobs = {};

  // ============================================================================
  // AUTOMATIC VIDEO CLEANUP
  // ============================================================================
  jobs.autoRemovalFrequency = async () => {
    logger.info('Running automatic video cleanup cron job');
    let result = null;
    let failure = null;
    try {
      result = await videoDeletionModule.performAutomaticCleanup();

      if (result.totalDeleted > 0) {
        logger.info({
          totalDeleted: result.totalDeleted,
          freedGB: (result.freedBytes / BYTES_PER_GB).toFixed(2)
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
      failure = failedRun(error);
    }

    // Always scan for orphan empty channel directories, regardless of auto-removal settings.
    // This handles directories left behind from deletions before the cleanup feature existed,
    // or from files deleted outside of Youtarr.
    let orphans = NO_ORPHAN_RESULT;
    try {
      const removal = await videoDeletionModule.cleanupOrphanDirectories();
      orphans = { removed: (removal && removal.removed) || [], errors: (removal && removal.errors) || [] };
    } catch (error) {
      logger.error({ err: error }, 'Error during orphan directory cleanup');
      orphans = { removed: [], errors: [error.message || 'Unknown error'] };
    }
    return failure || describeCleanup(result, orphans);
  };

  // ============================================================================
  // SESSION CLEANUP
  // ============================================================================
  jobs.sessionCleanupFrequency = async () => {
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
                [db.Sequelize.Op.lt]: new Date(Date.now() - INACTIVE_SESSION_MAX_AGE_MS)
              }
            }
          ]
        }
      });
      logger.info({ removed: result }, 'Removed expired sessions');
      return {
        status: 'success',
        outcome: 'completed',
        message: `Removed ${result} expired sessions.`,
        details: { removed: result },
      };
    } catch (error) {
      logger.error({ err: error }, 'Error cleaning sessions');
      return failedRun(error);
    }
  };

  // ============================================================================
  // VIDEO METADATA BACKFILL
  // ============================================================================
  jobs.videoRescanFrequency = async () => {
    logger.info('Starting scheduled video metadata backfill');
    try {
      // Await completion so another scheduled occurrence can't overlap this one.
      const result = await videosModule.backfillVideoMetadata({ trigger: 'scheduled' });
      if (result && result.timedOut) {
        logger.info('Video metadata backfill reached time limit, will continue at the next scheduled run');
      } else if (!result || result.status !== 'error') {
        logger.info('Video metadata backfill completed successfully');
      }
      return result ? rescanRunSummary.toRunRecord(result) : undefined;
    } catch (error) {
      // Only an unexpected rejection reaches this catch; the module reports its own failures.
      logger.error({ err: error }, 'Video metadata backfill failed');
      return failedRun(error);
    }
  };

  // ============================================================================
  // YT-DLP AUTO-UPDATE (only when enabled in config)
  // ============================================================================
  jobs.ytdlpUpdateFrequency = async () => {
    try {
      // The timer is disabled in both of these states, so only a run already in
      // flight when the setting changed can reach them.
      if (configModule.isElfhostedPlatform()) {
        return skippedRun('yt-dlp updates are managed by the hosting platform.');
      }

      const config = configModule.getConfig();
      if (!config.autoUpdateYtdlp) {
        return skippedRun('Automatic yt-dlp updates are turned off.');
      }

      logger.info('Running scheduled yt-dlp auto-update');
      const result = await ytdlpModule.performUpdate({ channel: config.ytdlpUpdateChannel });
      const summary = ytdlpUpdateRunSummary.toRunRecord(result);

      if (result.success) {
        if (summary.outcome === 'updated') {
          logger.info({ newVersion: result.newVersion }, 'Scheduled yt-dlp auto-update installed new version');
        } else {
          logger.info('Scheduled yt-dlp auto-update: already up to date');
        }
        if (typeof refreshYtDlpVersionCache === 'function') {
          try {
            refreshYtDlpVersionCache();
          } catch (err) {
            logger.warn({ err }, 'Failed to refresh yt-dlp version cache after auto-update');
          }
        }
      } else if (summary.outcome === 'skipped') {
        logger.info({ message: result.message }, 'Scheduled yt-dlp auto-update skipped');
      } else {
        logger.warn({ message: result.message }, 'Scheduled yt-dlp auto-update failed');
      }
      return summary;
    } catch (error) {
      logger.error({ err: error }, 'Unexpected error in scheduled yt-dlp auto-update');
      return failedRun(error);
    }
  };

  // ============================================================================
  // CHANNEL VIDEO COUNTS (per-tab YouTube totals for the download percentage)
  // ============================================================================
  jobs.channelVideoCountsFrequency = async () => {
    logger.info('Refreshing channel tab video counts');
    try {
      return await tabVideoCounts.refreshAll();
    } catch (error) {
      logger.error({ err: error }, 'Channel tab video count refresh failed');
      return failedRun(error);
    }
  };

  const reschedule = () => {
    const config = configModule.getConfig();
    for (const [id, run] of Object.entries(jobs)) {
      scheduledTasks.updateTask({
        id,
        expression: getSchedule(config, id),
        enabled: id !== 'ytdlpUpdateFrequency' ||
          (Boolean(config.autoUpdateYtdlp) && !configModule.isElfhostedPlatform()),
        run,
      });
    }
  };
  reschedule();
  configModule.onConfigChange(reschedule);
  initialized = true;
  logger.info('Scheduled cron jobs initialized successfully');
}

module.exports = { initialize };
