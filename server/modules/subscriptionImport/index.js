'use strict';

const { Op } = require('sequelize');
const logger = require('../../logger');
const { parseCsv } = require('./takeoutParser');
const { fetchWithCookies } = require('./cookiesFetcher');
const { enrichWithThumbnails } = require('./thumbnailEnricher');
const { runImport } = require('./importJobRunner');
const { JOB_TYPE } = require('./constants');

/**
 * Thrown when startImport is called while another import is already running.
 */
class ImportInProgressError extends Error {
  constructor(existingJobId) {
    super(`An import is already in progress (jobId: ${existingJobId})`);
    this.name = 'ImportInProgressError';
    this.existingJobId = existingJobId;
  }
}

/**
 * Query existing channels by IDs and return a Set of those already in the DB.
 *
 * @param {object} Channel - Sequelize Channel model
 * @param {string[]} channelIds - Array of YouTube channel IDs to check
 * @returns {Promise<Set<string>>} Set of channel IDs already subscribed
 */
async function crossReferenceExistingChannels(Channel, channelIds) {
  if (channelIds.length === 0) {
    return new Set();
  }

  const existing = await Channel.findAll({
    where: { channel_id: { [Op.in]: channelIds } },
    attributes: ['channel_id'],
    raw: true,
  });

  return new Set(existing.map((r) => r.channel_id));
}

/**
 * Shared logic for both parseTakeout and fetchWithCookiesPreview:
 * cross-reference channels against DB, enrich thumbnails, build response.
 *
 * @param {object} Channel - Sequelize Channel model
 * @param {Array} channels - Parsed channel array from parser/fetcher
 * @param {string} source - 'takeout' or 'cookies'
 * @returns {Promise<object>} Preview response shape
 */
async function buildPreviewResponse(Channel, channels, source) {
  const channelIds = channels.map((ch) => ch.channelId);

  // Cross-reference must throw on DB failure -- no silent degradation
  const existingSet = await crossReferenceExistingChannels(Channel, channelIds);

  const enriched = await enrichWithThumbnails(channels);

  const annotated = enriched.map((ch) => ({
    ...ch,
    alreadySubscribed: existingSet.has(ch.channelId),
  }));

  return {
    source,
    totalFound: channels.length,
    alreadySubscribedCount: existingSet.size,
    channels: annotated.sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    ),
  };
}

/**
 * Parse output JSON from a historical job row, handling both array results
 * and error-object shapes.
 *
 * @param {string} outputStr - Raw JSON string from job.output
 * @returns {{ results: Array, error: string|undefined }}
 */
function parseJobOutput(outputStr) {
  if (!outputStr) {
    return { results: [] };
  }

  try {
    const parsed = JSON.parse(outputStr);

    // Array shape: direct results
    if (Array.isArray(parsed)) {
      return { results: parsed };
    }

    // Object shape: { error, partialResults } from a failed import
    if (parsed && typeof parsed === 'object') {
      const results = parsed.partialResults || [];
      return { results, error: parsed.error };
    }

    return { results: [] };
  } catch {
    logger.warn({ outputStr: outputStr.slice(0, 200) }, 'Failed to parse job output JSON');
    return { results: [] };
  }
}

/**
 * Singleton module that orchestrates the subscription import feature.
 * Coordinates takeoutParser, cookiesFetcher, thumbnailEnricher, and importJobRunner.
 */
class SubscriptionImportModule {
  constructor() {
    this.deps = null;
    this.activeJob = null;
  }

  /**
   * Initialize with injected dependencies. Called once at startup.
   *
   * @param {{ channelModule: object, jobModule: object, messageEmitter: object, Channel: object }} deps
   */
  init(deps) {
    this.deps = deps;
    logger.info('SubscriptionImportModule initialized');
  }

  /**
   * Parse a Google Takeout CSV and return a preview with subscription status.
   *
   * @param {Buffer} csvBuffer - Raw CSV file buffer
   * @returns {Promise<{ source: string, totalFound: number, alreadySubscribedCount: number, channels: Array }>}
   */
  async parseTakeout(csvBuffer) {
    const channels = parseCsv(csvBuffer);
    return buildPreviewResponse(this.deps.Channel, channels, 'takeout');
  }

  /**
   * Fetch subscriptions via cookies file and return a preview with subscription status.
   *
   * @param {Buffer} cookiesBuffer - Netscape-format cookies.txt buffer
   * @returns {Promise<{ source: string, totalFound: number, alreadySubscribedCount: number, channels: Array }>}
   */
  async fetchWithCookiesPreview(cookiesBuffer) {
    const channels = await fetchWithCookies(cookiesBuffer);
    return buildPreviewResponse(this.deps.Channel, channels, 'cookies');
  }

  /**
   * Start importing selected channels. Fire-and-forget: kicks off the runner
   * and returns immediately with { jobId, total }.
   *
   * @param {Array<{ channelId: string, url: string, title: string }>} channels - Channels to import
   * @param {string} by - Who initiated the import (for logging/audit)
   * @returns {Promise<{ jobId: string, total: number }>}
   * @throws {ImportInProgressError} if an import is already running
   */
  async startImport(channels, by) {
    if (this.activeJob) {
      throw new ImportInProgressError(this.activeJob.jobId);
    }

    const total = channels.length;

    const jobId = await this.deps.jobModule.addOrUpdateJob({
      jobType: JOB_TYPE,
      output: '',
    });

    const activeJob = {
      jobId,
      total,
      results: [],
      cancelRequested: false,
      startedAt: Date.now(),
    };

    this.activeJob = activeJob;

    logger.info({ jobId, total, by }, 'Starting subscription import');

    // Fire-and-forget with guaranteed cleanup
    runImport(this.deps, activeJob, channels)
      .catch((err) => {
        logger.error({ err, jobId }, 'Unhandled error from import runner');
      })
      .finally(() => {
        this.activeJob = null;
      });

    return { jobId, total };
  }

  /**
   * Get a summary of the currently active import, or null if idle.
   *
   * @returns {{ jobId: string, total: number, done: number, cancelRequested: boolean, startedAt: number }|null}
   */
  getActiveImport() {
    if (!this.activeJob) {
      return null;
    }

    return {
      jobId: this.activeJob.jobId,
      total: this.activeJob.total,
      done: this.activeJob.results.length,
      cancelRequested: this.activeJob.cancelRequested,
      startedAt: this.activeJob.startedAt,
    };
  }

  /**
   * Get detailed state for a specific import job. Returns in-memory state for the
   * active job, or reconstructed state from the DB for historical jobs.
   *
   * @param {string} jobId
   * @returns {Promise<object|null>}
   */
  async getImport(jobId) {
    // Check active in-memory job first
    if (this.activeJob && this.activeJob.jobId === jobId) {
      return {
        jobId: this.activeJob.jobId,
        status: 'In Progress',
        total: this.activeJob.total,
        done: this.activeJob.results.length,
        results: this.activeJob.results,
        cancelRequested: this.activeJob.cancelRequested,
        startedAt: this.activeJob.startedAt,
      };
    }

    // Fall back to jobModule (in-memory jobs object / DB)
    const job = this.deps.jobModule.getJob(jobId);
    if (!job) {
      return null;
    }

    const { results, error } = parseJobOutput(job.output);

    const response = {
      jobId: job.id || jobId,
      status: job.status,
      total: results.length,
      done: results.length,
      results,
      startedAt: job.timeInitiated,
    };

    if (error) {
      response.error = error;
    }

    return response;
  }

  /**
   * List recent import job summaries, sorted by most recent first.
   *
   * @param {number} [limit=20] - Maximum number of jobs to return
   * @returns {Promise<Array<{ jobId: string, status: string, timeInitiated: number }>>}
   */
  async listImports(limit = 20) {
    const allJobs = this.deps.jobModule.jobs || {};

    const importJobs = Object.entries(allJobs)
      .filter(([, job]) => job.jobType === JOB_TYPE)
      .map(([id, job]) => {
        const { results } = parseJobOutput(job.output);
        return {
          jobId: id,
          status: job.status,
          startedAt: job.timeInitiated,
          total: results.length,
        };
      })
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
      .slice(0, limit);

    return importJobs;
  }

  /**
   * Request cancellation of the active import. Sets the cancelRequested flag
   * which the importJobRunner checks between channel imports.
   *
   * @param {string} jobId - Must match the active job's ID
   * @throws {Error} if no active import or jobId doesn't match
   */
  cancelImport(jobId) {
    if (!this.activeJob || this.activeJob.jobId !== jobId) {
      throw new Error(`No active import with jobId: ${jobId}`);
    }

    this.activeJob.cancelRequested = true;
    logger.info({ jobId }, 'Import cancellation requested');
  }
}

module.exports = new SubscriptionImportModule();
module.exports.ImportInProgressError = ImportInProgressError;
