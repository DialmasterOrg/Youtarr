const { Op } = require('sequelize');
const { normalizeExternalApiKey } = require('../middleware/externalApiAuth');
const { hasExternalScope } = require('./externalPermissions');

class QuotaError extends Error {
  constructor(message, code = 'quota_exceeded', status = 429) {
    super(message);
    this.name = 'QuotaError';
    this.code = code;
    this.status = status;
  }
}

function startOfHour(value) {
  const date = new Date(value);
  date.setUTCMinutes(0, 0, 0);
  return date;
}

function startOfDay(value) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function limitsFor(key) {
  return {
    maxActiveJobs: key.maxActiveJobs ?? key.max_active_jobs ?? 5,
    hourlyWriteLimit: key.hourlyWriteLimit ?? key.hourly_write_limit ?? 30,
    dailyWriteLimit: key.dailyWriteLimit ?? key.daily_write_limit ?? 200,
  };
}

function createExternalQuotaService({
  models = require('../models'),
  sequelize = require('../db').sequelize,
  now = () => new Date(),
} = {}) {
  const { ApiKey, ExternalRequest, ExternalApiUsageBucket, Video, Job } = models;

  async function reloadAuthorizedKey(keyId, requiredScope, transaction = null) {
    const record = await ApiKey.findByPk(keyId, {
      ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}),
    });
    const key = normalizeExternalApiKey(record);
    if (!key || !hasExternalScope(key, requiredScope)) {
      throw new QuotaError('External API authority changed', 'authority_changed', 403);
    }
    return key;
  }

  async function activeJobs(keyId, transaction = null, excludeRequestId = null) {
    const processing = await ExternalRequest.findAll({
      where: {
        api_key_id: keyId,
        status: 'processing',
        request_type: { [Op.in]: ['video', 'delete_video'] },
      },
      attributes: [
        'id', 'request_type', 'youtube_id', 'job_id', 'status',
        'active_dedupe_key',
      ],
      ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}),
    });
    if (processing.length > 0) {
      const youtubeIds = [...new Set(processing.map((record) => record.youtube_id))];
      const videos = await Video.findAll({
        where: { youtubeId: youtubeIds, removed: false },
        attributes: ['youtubeId'],
        ...(transaction ? { transaction } : {}),
      });
      const present = new Set(videos.map((video) => video.youtubeId));
      const terminalAt = now();
      const completed = processing.filter((record) =>
        (record.request_type === 'video' && present.has(record.youtube_id)) ||
        (record.request_type === 'delete_video' && !present.has(record.youtube_id))
      );
      await Promise.all(completed.map((record) => record.update({
        status: 'completed',
        active_dedupe_key: null,
        completed_at: terminalAt,
        updated_at: terminalAt,
      }, transaction ? { transaction } : {})));

      const unresolved = processing.filter((record) =>
        record.request_type === 'video' &&
        !present.has(record.youtube_id) &&
        record.job_id &&
        !completed.includes(record)
      );
      if (unresolved.length > 0) {
        const jobs = await Job.findAll({
          where: { id: [...new Set(unresolved.map((record) => record.job_id))] },
          attributes: ['id', 'status'],
          ...(transaction ? { transaction } : {}),
        });
        const terminalJobs = new Set(jobs
          .filter((job) => [
            'Error', 'Killed', 'Terminated', 'Complete', 'Complete with Warnings',
          ].includes(job.status))
          .map((job) => job.id));
        await Promise.all(unresolved
          .filter((record) => terminalJobs.has(record.job_id))
          .map((record) => record.update({
            status: 'failed',
            active_dedupe_key: null,
            message: 'Download did not complete',
            updated_at: terminalAt,
          }, transaction ? { transaction } : {})));
      }
    }
    return ExternalRequest.count({
      where: {
        api_key_id: keyId,
        ...(excludeRequestId ? { id: { [Op.ne]: excludeRequestId } } : {}),
        [Op.or]: [
          { status: { [Op.in]: ['approved', 'processing'] } },
          { status: 'pending', decided_at: { [Op.ne]: null } },
        ],
      },
      ...(transaction ? { transaction } : {}),
    });
  }

  async function getBucket(keyId, windowType, windowStart, transaction = null) {
    const [bucket] = await ExternalApiUsageBucket.findOrCreate({
      where: {
        api_key_id: keyId,
        window_type: windowType,
        window_start: windowStart,
      },
      defaults: {
        api_key_id: keyId,
        window_type: windowType,
        window_start: windowStart,
        accepted_writes: 0,
        created_at: now(),
        updated_at: now(),
      },
      ...(transaction ? { transaction } : {}),
    });
    if (transaction) {
      return ExternalApiUsageBucket.findByPk(bucket.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    }
    return bucket;
  }

  async function reserveWrite(keyId, requiredScope, transaction = null) {
    const reserve = async (activeTransaction) => {
      const key = await reloadAuthorizedKey(keyId, requiredScope, activeTransaction);
      const limits = limitsFor(key);
      const active = await activeJobs(keyId, activeTransaction);
      if (active >= limits.maxActiveJobs) {
        throw new QuotaError('External API active job limit exceeded', 'active_job_limit');
      }
      const timestamp = now();
      const hour = await getBucket(keyId, 'hour', startOfHour(timestamp), activeTransaction);
      const day = await getBucket(keyId, 'day', startOfDay(timestamp), activeTransaction);
      if (hour.accepted_writes >= limits.hourlyWriteLimit) {
        throw new QuotaError('External API hourly write limit exceeded', 'hourly_write_limit');
      }
      if (day.accepted_writes >= limits.dailyWriteLimit) {
        throw new QuotaError('External API daily write limit exceeded', 'daily_write_limit');
      }
      await hour.update({
        accepted_writes: hour.accepted_writes + 1,
        updated_at: timestamp,
      }, { transaction: activeTransaction });
      await day.update({
        accepted_writes: day.accepted_writes + 1,
        updated_at: timestamp,
      }, { transaction: activeTransaction });
      return key;
    };
    return transaction ? reserve(transaction) : sequelize.transaction(reserve);
  }

  async function assertExecutionCapacity(
    keyId,
    requiredScope,
    requestId,
    transaction = null
  ) {
    const check = async (activeTransaction) => {
      const key = await reloadAuthorizedKey(keyId, requiredScope, activeTransaction);
      const active = await activeJobs(keyId, activeTransaction, requestId);
      if (active >= limitsFor(key).maxActiveJobs) {
        throw new QuotaError('External API active job limit exceeded', 'active_job_limit');
      }
      return key;
    };
    return transaction ? check(transaction) : sequelize.transaction(check);
  }

  async function status(key) {
    const limits = limitsFor(key);
    const timestamp = now();
    const [active, hour, day] = await Promise.all([
      activeJobs(key.id),
      ExternalApiUsageBucket.findOne({
        where: {
          api_key_id: key.id,
          window_type: 'hour',
          window_start: startOfHour(timestamp),
        },
      }),
      ExternalApiUsageBucket.findOne({
        where: {
          api_key_id: key.id,
          window_type: 'day',
          window_start: startOfDay(timestamp),
        },
      }),
    ]);
    const hourlyUsed = hour?.accepted_writes || 0;
    const dailyUsed = day?.accepted_writes || 0;
    return {
      limits,
      remaining: {
        activeJobs: Math.max(0, limits.maxActiveJobs - active),
        hourlyWrites: Math.max(0, limits.hourlyWriteLimit - hourlyUsed),
        dailyWrites: Math.max(0, limits.dailyWriteLimit - dailyUsed),
      },
    };
  }

  return { reserveWrite, reloadAuthorizedKey, assertExecutionCapacity, status };
}

module.exports = {
  createExternalQuotaService,
  QuotaError,
  startOfHour,
  startOfDay,
  limitsFor,
};
