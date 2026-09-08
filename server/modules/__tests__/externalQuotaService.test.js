const {
  createExternalQuotaService,
  QuotaError,
  startOfHour,
  startOfDay,
} = require('../externalQuotaService');

const now = new Date('2026-07-28T15:42:30.000Z');

function key(overrides = {}) {
  return {
    id: 4,
    name: 'Client',
    role: 'request',
    is_active: true,
    revoked_at: null,
    allow_video_requests: true,
    allow_channel_requests: true,
    allow_delete_video_requests: false,
    auto_approve_video_requests: false,
    auto_approve_channel_requests: false,
    auto_approve_delete_requests: false,
    max_rating_level: 3,
    allow_unrated: false,
    allowed_media_types: ['video'],
    max_active_jobs: 5,
    hourly_write_limit: 30,
    daily_write_limit: 200,
    ...overrides,
  };
}

function fixture({ active = 0, hourWrites = 0, dayWrites = 0, keyOverrides = {} } = {}) {
  const hour = {
    id: 1,
    accepted_writes: hourWrites,
    update: jest.fn(async function update(values) { Object.assign(this, values); }),
  };
  const day = {
    id: 2,
    accepted_writes: dayWrites,
    update: jest.fn(async function update(values) { Object.assign(this, values); }),
  };
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const models = {
    ApiKey: { findByPk: jest.fn().mockResolvedValue(key(keyOverrides)) },
    ExternalRequest: {
      findAll: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(active),
    },
    Video: { findAll: jest.fn().mockResolvedValue([]) },
    Job: { findAll: jest.fn().mockResolvedValue([]) },
    ExternalApiUsageBucket: {
      findOrCreate: jest.fn()
        .mockResolvedValueOnce([hour, hourWrites === 0])
        .mockResolvedValueOnce([day, dayWrites === 0]),
      findByPk: jest.fn()
        .mockResolvedValueOnce(hour)
        .mockResolvedValueOnce(day),
      findOne: jest.fn()
        .mockResolvedValueOnce(hour)
        .mockResolvedValueOnce(day),
    },
  };
  const sequelize = {
    transaction: jest.fn(async (callback) => callback(transaction)),
  };
  return {
    service: createExternalQuotaService({ models, sequelize, now: () => now }),
    models,
    hour,
    day,
    transaction,
  };
}

describe('external API durable quotas', () => {
  test('uses stable UTC hour and day buckets', () => {
    expect(startOfHour(now).toISOString()).toBe('2026-07-28T15:00:00.000Z');
    expect(startOfDay(now).toISOString()).toBe('2026-07-28T00:00:00.000Z');
  });

  test('atomically reserves hourly and daily allowance', async () => {
    const { service, hour, day } = fixture({ hourWrites: 2, dayWrites: 9 });
    const authorized = await service.reserveWrite(4, 'video:request');
    expect(authorized.id).toBe(4);
    expect(hour.update).toHaveBeenCalledWith(
      expect.objectContaining({ accepted_writes: 3 }),
      expect.objectContaining({ transaction: expect.anything() })
    );
    expect(day.update).toHaveBeenCalledWith(
      expect.objectContaining({ accepted_writes: 10 }),
      expect.objectContaining({ transaction: expect.anything() })
    );
  });

  test('fails closed when a durable limit is exhausted', async () => {
    const { service } = fixture({
      hourWrites: 3,
      keyOverrides: { hourly_write_limit: 3 },
    });
    await expect(service.reserveWrite(4, 'video:request')).rejects.toEqual(
      expect.objectContaining({
        name: 'QuotaError',
        code: 'hourly_write_limit',
        status: 429,
      })
    );
  });

  test('rejects changed authority before an execution side effect', async () => {
    const { service, models } = fixture();
    models.ApiKey.findByPk.mockResolvedValue(key({
      allow_video_requests: false,
      role: 'view',
    }));
    await expect(
      service.assertExecutionCapacity(4, 'video:request', 'request-id')
    ).rejects.toBeInstanceOf(QuotaError);
  });

  test('reconciles completed downloads before reporting active capacity', async () => {
    const completedRequest = {
      id: 'request-1',
      request_type: 'video',
      youtube_id: 'abcdefghijk',
      job_id: 'job-1',
      status: 'processing',
      update: jest.fn(async function update(values) {
        Object.assign(this, values);
      }),
    };
    const { service, models } = fixture({ active: 1 });
    models.ExternalRequest.findAll.mockResolvedValue([completedRequest]);
    models.Video.findAll.mockResolvedValue([{ youtubeId: 'abcdefghijk' }]);
    models.ExternalRequest.count.mockImplementation(async () =>
      completedRequest.status === 'processing' ? 1 : 0
    );

    const result = await service.status({
      id: 4,
      maxActiveJobs: 5,
      hourlyWriteLimit: 30,
      dailyWriteLimit: 200,
    });

    expect(completedRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', active_dedupe_key: null }),
      {}
    );
    expect(result.remaining.activeJobs).toBe(5);
  });
});
