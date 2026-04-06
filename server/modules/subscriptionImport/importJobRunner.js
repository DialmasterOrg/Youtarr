'use strict';

const logger = require('../../logger');
const createLimiter = require('./concurrencyLimiter');
const { IMPORT_CONCURRENCY, WS_SOURCE } = require('./constants');

/**
 * Broadcast a WebSocket message for the subscription import feature.
 * Swallows errors so a WS failure never disrupts the import.
 *
 * @param {object} messageEmitter - The messageEmitter dependency
 * @param {string} jobId - Current job ID
 * @param {string} type - Message type (e.g. 'progress', 'complete', 'error')
 * @param {object} data - Payload data
 */
function broadcast(messageEmitter, jobId, type, data) {
  try {
    messageEmitter.emitMessage('broadcast', null, WS_SOURCE, type, {
      jobId,
      ...data,
    });
  } catch (err) {
    logger.warn({ err, jobId }, 'Failed to broadcast import event');
  }
}

/**
 * Process a single channel for import.
 * Handles the belt-and-suspenders duplicate check, calls getChannelInfo,
 * and records the result.
 *
 * @param {object} deps - Injected dependencies
 * @param {object} activeJob - Mutable in-memory job state
 * @param {object} ch - Channel descriptor { channelId, url, title, settings }
 */
async function processOneChannel(deps, activeJob, ch) {
  const { channelModule, messageEmitter, Channel } = deps;

  // Check cancellation before starting
  if (activeJob.cancelRequested) {
    activeJob.results.push({
      channelId: ch.channelId,
      title: ch.title || ch.channelId,
      state: 'skipped',
      reason: 'Cancelled',
    });
    broadcast(messageEmitter, activeJob.jobId, 'progress', {
      done: activeJob.results.length,
      total: activeJob.total,
      lastResult: activeJob.results[activeJob.results.length - 1],
    });
    return;
  }

  // Belt-and-suspenders: verify the channel isn't already in the DB
  try {
    const existing = await Channel.findOne({
      where: { channel_id: ch.channelId },
      attributes: ['channel_id'],
    });
    if (existing) {
      activeJob.results.push({
        channelId: ch.channelId,
        title: ch.title || ch.channelId,
        state: 'skipped',
        reason: 'Already subscribed',
      });
      broadcast(messageEmitter, activeJob.jobId, 'progress', {
        done: activeJob.results.length,
        total: activeJob.total,
        lastResult: activeJob.results[activeJob.results.length - 1],
      });
      return;
    }
  } catch (dbErr) {
    logger.warn(
      { err: dbErr, channelId: ch.channelId },
      'Failed belt-and-suspenders check, proceeding with import'
    );
  }

  // Main import via getChannelInfo
  try {
    const url =
      ch.url || `https://www.youtube.com/channel/${ch.channelId}`;

    // getChannelInfo(channelUrlOrId, emitMessage, enableChannel)
    // emitMessage = false because we broadcast our own progress
    // enableChannel = true so the channel is active immediately
    await channelModule.getChannelInfo(url, false, true);

    activeJob.results.push({
      channelId: ch.channelId,
      title: ch.title || ch.channelId,
      state: 'success',
    });
  } catch (err) {
    logger.warn({ err, channelId: ch.channelId }, 'Failed to import channel');
    activeJob.results.push({
      channelId: ch.channelId,
      title: ch.title || ch.channelId,
      state: 'error',
      error: err.message || 'Unknown error',
    });
  }

  broadcast(messageEmitter, activeJob.jobId, 'progress', {
    done: activeJob.results.length,
    total: activeJob.total,
    lastResult: activeJob.results[activeJob.results.length - 1],
  });
}

/**
 * Run the Phase 2 subscription import: process each selected channel under
 * a concurrency cap, broadcast progress over WebSocket, handle per-channel
 * errors without aborting, support cancellation, and write final results
 * to the Job row.
 *
 * @param {object} deps - Injected dependencies: { channelModule, jobModule, messageEmitter, Channel }
 * @param {object} activeJob - Mutable in-memory state: { jobId, total, results: [], cancelRequested: false }
 * @param {Array<object>} channels - Array of { channelId, url, title, settings }
 */
async function runImport(deps, activeJob, channels) {
  const { jobModule, messageEmitter } = deps;
  const limit = createLimiter(IMPORT_CONCURRENCY);

  try {
    await Promise.all(
      channels.map((ch) =>
        limit(() => processOneChannel(deps, activeJob, ch))
      )
    );

    // Determine final status
    const wasCancelled = activeJob.cancelRequested;
    const hasErrors = activeJob.results.some((r) => r.state === 'error');

    let finalStatus;
    if (wasCancelled) {
      finalStatus = 'Cancelled';
    } else if (hasErrors) {
      finalStatus = 'Complete with Warnings';
    } else {
      finalStatus = 'Complete';
    }

    await jobModule.updateJob(activeJob.jobId, {
      status: finalStatus,
      output: JSON.stringify(activeJob.results),
    });

    const successes = activeJob.results.filter(
      (r) => r.state === 'success'
    ).length;
    const errors = activeJob.results.filter(
      (r) => r.state === 'error'
    ).length;
    const skipped = activeJob.results.filter(
      (r) => r.state === 'skipped'
    ).length;

    broadcast(messageEmitter, activeJob.jobId, 'complete', {
      status: finalStatus,
      successes,
      errors,
      skipped,
    });

    logger.info(
      { jobId: activeJob.jobId, successes, errors, skipped, finalStatus },
      'Subscription import complete'
    );
  } catch (err) {
    logger.error(
      { err, jobId: activeJob.jobId },
      'Import job runner threw unexpectedly'
    );
    try {
      await jobModule.updateJob(activeJob.jobId, {
        status: 'Failed',
        output: JSON.stringify({
          error: err.message,
          partialResults: activeJob.results,
        }),
      });
      broadcast(messageEmitter, activeJob.jobId, 'error', {
        error: err.message,
      });
    } catch (updateErr) {
      logger.error(
        { err: updateErr },
        'Failed to update job status after runner error'
      );
    }
  }
}

module.exports = { runImport };
