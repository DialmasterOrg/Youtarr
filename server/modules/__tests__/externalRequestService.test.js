const { createExternalRequestService, RequestError } = require('../externalRequestService');

const timestamp = new Date('2026-07-26T12:00:00.000Z');
const youtubeId = 'abcdefghijk';

function record(overrides = {}) {
  return {
    id: '9b89e5bc-8c90-4e72-b245-270fed2eacc2',
    api_key_id: 4,
    channel_id: 8,
    youtube_id: youtubeId,
    request_type: 'video',
    status: 'pending',
    created_at: timestamp,
    updated_at: timestamp,
    decided_at: null,
    completed_at: null,
    message: null,
    update: jest.fn(async function update(values) {
      Object.assign(this, values);
    }),
    ...overrides,
  };
}

function fixture(overrides = {}) {
  const created = record();
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const models = {
    ExternalRequest: {
      create: jest.fn(async (values) => Object.assign(created, values)),
      update: jest.fn().mockResolvedValue([1]),
      findOne: jest.fn().mockResolvedValue(null),
      findByPk: jest.fn().mockResolvedValue(null),
      findAndCountAll: jest.fn().mockResolvedValue({ rows: [], count: 0 }),
    },
    ApiKeyChannelGrant: {
      findOne: jest.fn().mockResolvedValue({ id: 1 }),
      findOrCreate: jest.fn().mockResolvedValue([{ id: 1 }, true]),
    },
    Channel: {
      findByPk: jest.fn().mockResolvedValue({
        id: 8, channel_id: 'UC1234567890123456789012', enabled: true, default_rating: 'TV-Y',
      }),
      findOne: jest.fn().mockResolvedValue({
        id: 8, channel_id: 'UC1234567890123456789012', enabled: true,
        terminated_at: null, default_rating: 'TV-Y',
      }),
    },
    ChannelVideo: {
      findOne: jest.fn().mockResolvedValue({
        youtube_id: youtubeId, media_type: 'video', youtube_removed: false, ignored: false,
      }),
      findAll: jest.fn().mockResolvedValue([]),
    },
    Video: { findOne: jest.fn().mockResolvedValue(null), findAll: jest.fn().mockResolvedValue([]) },
    Job: { findAll: jest.fn().mockResolvedValue([]) },
    ApiKey: {
      findByPk: jest.fn().mockResolvedValue({
        id: 4,
        name: 'External Client',
        role: 'request',
        is_active: true,
        revoked_at: null,
        allow_video_requests: true,
        allow_channel_requests: true,
        allow_delete_video_requests: false,
        auto_approve_video_requests: false,
        auto_approve_channel_requests: false,
        auto_approve_delete_requests: false,
        max_rating_level: 2,
        allow_unrated: false,
        allowed_media_types: ['video'],
        max_active_jobs: 5,
        hourly_write_limit: 30,
        daily_write_limit: 200,
      }),
      findAll: jest.fn().mockResolvedValue([]),
    },
    ...overrides.models,
  };
  const sequelize = {
    transaction: jest.fn(async (callback) => callback(transaction)),
  };
  const executor = jest.fn().mockResolvedValue(undefined);
  const channelProvisioner = overrides.channelProvisioner || {
    getChannelInfo: jest.fn().mockResolvedValue({ channel_id: 'UC1234567890123456789012' }),
  };
  const videoDeleter = overrides.videoDeleter || {
    deleteVideosByYoutubeIds: jest.fn().mockResolvedValue({ success: true, failed: [] }),
    deleteVideoById: jest.fn().mockResolvedValue({ success: true }),
  };
  const quotaService = overrides.quotaService || {
    reserveWrite: jest.fn(async () => ({
      id: 4,
      name: 'External Client',
      role: 'request',
      isActive: true,
      autoApproveVideoRequests: overrides.key?.autoApproveVideoRequests ?? false,
      autoApproveChannelRequests: overrides.key?.autoApproveChannelRequests ?? false,
      autoApproveDeleteRequests: overrides.key?.autoApproveDeleteRequests ?? false,
      allowVideoRequests: overrides.key?.allowVideoRequests ?? true,
      allowChannelRequests: overrides.key?.allowChannelRequests ?? true,
      allowDeleteVideoRequests: overrides.key?.allowDeleteVideoRequests ?? false,
      maxRatingLevel: 2,
      allowUnrated: false,
      allowedMediaTypes: ['video'],
    })),
    reloadAuthorizedKey: jest.fn(async () => ({
      id: 4,
      name: 'External Client',
      role: 'request',
      autoApproveVideoRequests: overrides.key?.autoApproveVideoRequests ?? false,
      autoApproveChannelRequests: overrides.key?.autoApproveChannelRequests ?? false,
      autoApproveDeleteRequests: overrides.key?.autoApproveDeleteRequests ?? false,
      allowVideoRequests: overrides.key?.allowVideoRequests ?? true,
      allowChannelRequests: overrides.key?.allowChannelRequests ?? true,
      allowDeleteVideoRequests: overrides.key?.allowDeleteVideoRequests ?? false,
      maxRatingLevel: 2,
      allowUnrated: false,
      allowedMediaTypes: ['video'],
    })),
    assertExecutionCapacity: jest.fn(async () => ({
      id: 4,
      name: 'External Client',
      role: 'request',
      autoApproveVideoRequests: overrides.key?.autoApproveVideoRequests ?? false,
      autoApproveChannelRequests: overrides.key?.autoApproveChannelRequests ?? false,
      autoApproveDeleteRequests: overrides.key?.autoApproveDeleteRequests ?? false,
      allowVideoRequests: overrides.key?.allowVideoRequests ?? true,
      allowChannelRequests: overrides.key?.allowChannelRequests ?? true,
      allowDeleteVideoRequests: overrides.key?.allowDeleteVideoRequests ?? false,
      maxRatingLevel: 2,
      allowUnrated: false,
      allowedMediaTypes: ['video'],
    })),
  };
  const service = createExternalRequestService({
    models,
    executor: overrides.executor || executor,
    channelProvisioner,
    videoDeleter,
    now: overrides.now || (() => timestamp),
    sequelize: overrides.sequelize || sequelize,
    quotaService,
    workLimiter: overrides.workLimiter,
  });
  const key = {
    id: 4,
    name: 'External Client',
    role: 'request',
    autoApproveVideoRequests: false,
    autoApproveChannelRequests: false,
    autoApproveDeleteRequests: false,
    maxRatingLevel: 2,
    allowUnrated: false,
    allowedMediaTypes: ['video'],
    ...overrides.key,
  };
  return {
    service, models, executor, key, created, sequelize, transaction,
    channelProvisioner, videoDeleter, quotaService,
  };
}

describe('external video request service', () => {
  test('persists a pending request without executing a download', async () => {
    const { service, models, executor, key, transaction, quotaService } = fixture();
    const result = await service.createVideoRequest(key, { youtubeId, channelId: 8 });
    expect(result).toMatchObject({
      outcome: 'created',
      request: { type: 'video', status: 'pending', target: { youtubeId, channelId: 8 } },
    });
    expect(models.ExternalRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      api_key_id: 4,
      active_dedupe_key: `4:video:${youtubeId}`,
      status: 'pending',
    }), { transaction });
    expect(quotaService.reserveWrite).toHaveBeenCalledWith(
      4,
      'video:request',
      transaction
    );
    expect(executor).not.toHaveBeenCalled();
  });

  test('auto-approval queues only the canonical URL and server-owned channel mapping', async () => {
    const { service, models, executor, key, transaction } = fixture({
      key: { autoApproveVideoRequests: true },
    });
    const result = await service.createVideoRequest(key, {
      youtubeId, channelId: 8, idempotencyKey: 'external-client-1',
    });
    expect(models.ExternalRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pending',
      decided_at: timestamp,
      idempotency_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }), { transaction });
    expect(executor).toHaveBeenCalledWith({
      body: {
        urls: [`https://www.youtube.com/watch?v=${youtubeId}`],
        channelId: 'UC1234567890123456789012',
        ownerChannelMap: { [youtubeId]: 'UC1234567890123456789012' },
        initiatedBy: { type: 'api_key', name: 'External Client' },
        jobLabel: 'External video request',
        externalRequestId: '9b89e5bc-8c90-4e72-b245-270fed2eacc2',
      },
    });
    expect(result.request.status).toBe('processing');
  });

  test('returns service unavailable when the shared work queue is full', async () => {
    const workError = Object.assign(new Error('full'), {
      name: 'ExternalWorkLimitError',
    });
    const limited = fixture({
      key: { autoApproveVideoRequests: true },
      workLimiter: { run: jest.fn().mockRejectedValue(workError) },
    });
    await expect(limited.service.createVideoRequest(limited.key, {
      youtubeId,
      channelId: 8,
    })).rejects.toMatchObject({
      name: 'RequestError',
      status: 503,
      code: 'work_queue_full',
    });
    expect(limited.created.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      active_dedupe_key: null,
    }));
  });

  test('revalidates a channel grant inside the work slot before enqueue', async () => {
    const raced = fixture({
      key: { autoApproveVideoRequests: true },
    });
    raced.models.ApiKeyChannelGrant.findOne
      .mockResolvedValueOnce({ api_key_id: 4, channel_id: 8 })
      .mockResolvedValueOnce({ api_key_id: 4, channel_id: 8 })
      .mockResolvedValueOnce(null);

    const result = await raced.service.createVideoRequest(raced.key, {
      youtubeId,
      channelId: 8,
    });

    expect(raced.executor).not.toHaveBeenCalled();
    expect(raced.created.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      active_dedupe_key: null,
    }));
    expect(result.request.status).toBe('failed');
  });

  test('does not enqueue when video auto-approval is disabled before execution', async () => {
    const raced = fixture({ key: { autoApproveVideoRequests: true } });
    raced.quotaService.assertExecutionCapacity.mockResolvedValue({
      ...raced.key,
      allowVideoRequests: true,
      autoApproveVideoRequests: false,
    });

    const result = await raced.service.createVideoRequest(raced.key, {
      youtubeId,
      channelId: 8,
    });

    expect(raced.executor).not.toHaveBeenCalled();
    expect(result.request.status).toBe('failed');
  });

  test('resumes an interrupted auto-approved dispatch with the stable request job id', async () => {
    const interrupted = record({ status: 'pending', decided_at: timestamp, job_id: null });
    const retryExecutor = jest.fn().mockResolvedValue(interrupted.id);
    const retry = fixture({
      key: { autoApproveVideoRequests: true },
      executor: retryExecutor,
    });
    retry.models.ExternalRequest.findOne.mockResolvedValue(interrupted);
    const result = await retry.service.createVideoRequest(
      retry.key,
      { youtubeId, channelId: 8, idempotencyKey: 'same-request' }
    );
    expect(retry.models.ExternalRequest.create).not.toHaveBeenCalled();
    expect(retryExecutor).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ externalRequestId: interrupted.id }),
    }));
    expect(interrupted.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'processing',
      job_id: interrupted.id,
    }));
    expect(result).toMatchObject({
      outcome: 'duplicate',
      request: { status: 'processing' },
    });
  });

  test('fails closed for missing grants, unknown media, and ratings above policy', async () => {
    const missingGrant = fixture();
    missingGrant.models.ApiKeyChannelGrant.findOne.mockResolvedValue(null);
    await expect(missingGrant.service.createVideoRequest(
      missingGrant.key, { youtubeId, channelId: 8 }
    )).rejects.toMatchObject({ status: 404 });

    const unknownMedia = fixture();
    unknownMedia.models.ChannelVideo.findOne.mockResolvedValue({
      youtube_id: youtubeId, media_type: 'unknown', youtube_removed: false, ignored: false,
    });
    await expect(unknownMedia.service.createVideoRequest(
      unknownMedia.key, { youtubeId, channelId: 8 }
    )).rejects.toMatchObject({ status: 404, message: 'Video not found' });

    const mature = fixture();
    mature.models.Channel.findByPk.mockResolvedValue({
      id: 8, channel_id: 'UC1234567890123456789012', enabled: true, default_rating: 'R',
    });
    await expect(mature.service.createVideoRequest(
      mature.key, { youtubeId, channelId: 8 }
    )).rejects.toMatchObject({ status: 404, message: 'Video not found' });
  });

  test('returns downloaded and concurrent duplicate outcomes without a second row', async () => {
    const downloaded = fixture();
    downloaded.models.Video.findOne.mockResolvedValue({
      youtubeId, normalized_rating: 'TV-Y', removed: false,
    });
    await expect(downloaded.service.createVideoRequest(
      downloaded.key, { youtubeId, channelId: 8 }
    )).resolves.toEqual({ outcome: 'already_downloaded', request: null });
    expect(downloaded.models.ExternalRequest.create).not.toHaveBeenCalled();

    const duplicateRecord = record({ status: 'processing' });
    const duplicate = fixture();
    duplicate.models.ExternalRequest.findOne.mockResolvedValue(duplicateRecord);
    const result = await duplicate.service.createVideoRequest(
      duplicate.key, { youtubeId, channelId: 8 }
    );
    expect(result).toMatchObject({ outcome: 'duplicate', request: { status: 'processing' } });
    expect(duplicate.models.ExternalRequest.create).not.toHaveBeenCalled();
  });

  test('returns the winning row when the database unique key resolves a create race', async () => {
    const duplicateRecord = record({ status: 'pending' });
    const concurrent = fixture();
    concurrent.models.ExternalRequest.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(duplicateRecord);
    concurrent.models.ExternalRequest.create.mockRejectedValue(
      Object.assign(new Error('duplicate'), { name: 'SequelizeUniqueConstraintError' })
    );
    await expect(concurrent.service.createVideoRequest(
      concurrent.key, { youtubeId, channelId: 8 }
    )).resolves.toMatchObject({ outcome: 'duplicate', request: { id: duplicateRecord.id } });
  });

  test('creates a canonical approval-backed channel request', async () => {
    const pending = fixture();
    const result = await pending.service.createChannelRequest(pending.key, {
      channelUrl: 'youtube.com/@Safe Family',
      idempotencyKey: 'channel-1',
    });

    expect(pending.models.ExternalRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      api_key_id: 4,
      channel_id: null,
      youtube_id: null,
      channel_url: 'https://www.youtube.com/@Safe%20Family',
      request_type: 'channel',
      status: 'pending',
      idempotency_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }), { transaction: pending.transaction });
    expect(result).toMatchObject({
      outcome: 'created',
      request: {
        type: 'channel',
        status: 'pending',
        target: { channelUrl: 'https://www.youtube.com/@Safe%20Family' },
      },
    });
    expect(pending.channelProvisioner.getChannelInfo).not.toHaveBeenCalled();
  });

  test('auto-approved channel requests provision and grant the resulting channel', async () => {
    const approved = fixture({ key: { autoApproveChannelRequests: true } });
    const result = await approved.service.createChannelRequest(approved.key, {
      channelUrl: 'https://www.youtube.com/channel/UC1234567890123456789012',
    });

    expect(approved.channelProvisioner.getChannelInfo).toHaveBeenCalledWith(
      'https://www.youtube.com/channel/UC1234567890123456789012',
      false,
      true,
      {},
      { skipTabDetection: true }
    );
    expect(approved.models.ApiKeyChannelGrant.findOrCreate).toHaveBeenCalledWith({
      where: { api_key_id: 4, channel_id: 8 },
      defaults: { api_key_id: 4, channel_id: 8 },
      transaction: approved.transaction,
    });
    expect(result.request).toMatchObject({
      type: 'channel',
      status: 'completed',
      target: { channelId: 8 },
    });
  });

  test('does not provision when channel auto-approval is disabled before execution', async () => {
    const raced = fixture({ key: { autoApproveChannelRequests: true } });
    raced.quotaService.assertExecutionCapacity.mockResolvedValue({
      ...raced.key,
      allowChannelRequests: true,
      autoApproveChannelRequests: false,
    });

    const result = await raced.service.createChannelRequest(raced.key, {
      channelUrl: 'https://www.youtube.com/@safe',
    });

    expect(raced.channelProvisioner.getChannelInfo).not.toHaveBeenCalled();
    expect(result.request.status).toBe('failed');
  });

  test('returns the winning channel request when a concurrent create wins', async () => {
    const winner = record({
      request_type: 'channel',
      channel_id: null,
      youtube_id: null,
      channel_url: 'https://www.youtube.com/@safe',
    });
    const concurrent = fixture();
    concurrent.models.ExternalRequest.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner);
    concurrent.models.ExternalRequest.create.mockRejectedValue(
      Object.assign(new Error('duplicate'), { name: 'SequelizeUniqueConstraintError' })
    );

    await expect(concurrent.service.createChannelRequest(concurrent.key, {
      channelUrl: 'https://www.youtube.com/@safe',
    })).resolves.toMatchObject({
      outcome: 'duplicate',
      request: { id: winner.id, type: 'channel' },
    });
  });

  test('resumes an interrupted auto-approved channel request on idempotent retry', async () => {
    const interrupted = record({
      request_type: 'channel',
      channel_id: null,
      youtube_id: null,
      channel_url: 'https://www.youtube.com/@safe',
      status: 'pending',
      decided_at: timestamp,
    });
    const recovering = fixture({
      key: { autoApproveChannelRequests: true },
    });
    recovering.models.ExternalRequest.findOne.mockResolvedValue(interrupted);

    const result = await recovering.service.createChannelRequest(recovering.key, {
      channelUrl: 'https://www.youtube.com/@safe',
    });

    expect(recovering.channelProvisioner.getChannelInfo).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      outcome: 'duplicate',
      request: { type: 'channel', status: 'completed' },
    });
  });

  test('delete requests are role-bound and hide absent targets', async () => {
    const forbidden = fixture();
    await expect(forbidden.service.createDeleteVideoRequest(forbidden.key, {
      youtubeId,
      channelId: 8,
    })).rejects.toMatchObject({ status: 403 });

    const absent = fixture({ key: { role: 'delete' } });
    await expect(absent.service.createDeleteVideoRequest(absent.key, {
      youtubeId,
      channelId: 8,
    })).rejects.toMatchObject({ status: 404, message: 'Video not found' });
    expect(absent.models.ExternalRequest.create).not.toHaveBeenCalled();
    expect(absent.videoDeleter.deleteVideoById).not.toHaveBeenCalled();
  });

  test('auto-approved deletion reaches a completed terminal state', async () => {
    const deleting = fixture({
      key: { role: 'delete', autoApproveDeleteRequests: true },
    });
    deleting.models.Video.findOne.mockResolvedValue({
      id: 91,
      youtubeId,
      normalized_rating: 'TV-Y',
      removed: false,
    });

    const result = await deleting.service.createDeleteVideoRequest(deleting.key, {
      youtubeId,
      channelId: 8,
      idempotencyKey: 'delete-1',
    });

    expect(deleting.videoDeleter.deleteVideoById).toHaveBeenCalledWith(
      91,
      expect.objectContaining({
        transaction: deleting.transaction,
        video: expect.objectContaining({ id: 91, youtubeId }),
      })
    );
    expect(result).toMatchObject({
      outcome: 'created',
      request: { type: 'delete_video', status: 'completed' },
    });
  });

  test('does not delete when delete auto-approval is disabled before execution', async () => {
    const raced = fixture({
      key: { role: 'delete', autoApproveDeleteRequests: true },
    });
    raced.models.Video.findOne.mockResolvedValue({
      id: 91,
      youtubeId,
      normalized_rating: 'TV-Y',
      removed: false,
    });
    raced.quotaService.assertExecutionCapacity.mockResolvedValue({
      ...raced.key,
      role: 'delete',
      allowDeleteVideoRequests: true,
      autoApproveDeleteRequests: false,
    });

    const result = await raced.service.createDeleteVideoRequest(raced.key, {
      youtubeId,
      channelId: 8,
    });

    expect(raced.videoDeleter.deleteVideoById).not.toHaveBeenCalled();
    expect(result.request.status).toBe('failed');
  });

  test('deletion completes idempotently when the target disappears during execution', async () => {
    const deleting = fixture({
      key: { role: 'delete', autoApproveDeleteRequests: true },
      videoDeleter: {
        deleteVideoById: jest.fn().mockResolvedValue({
          success: false,
          error: 'Video not found in database',
        }),
      },
    });
    deleting.models.Video.findOne.mockResolvedValue({
      id: 91,
      youtubeId,
      normalized_rating: 'TV-Y',
      removed: false,
    });

    const result = await deleting.service.createDeleteVideoRequest(deleting.key, {
      youtubeId,
      channelId: 8,
    });

    expect(result.request).toMatchObject({
      status: 'completed',
      message: 'Video is already deleted',
    });
  });

  test('recovers a stale processing deletion idempotently', async () => {
    const stale = record({
      request_type: 'delete_video',
      status: 'processing',
      channel_url: null,
      decided_at: new Date('2026-07-26T11:00:00.000Z'),
      updated_at: new Date('2026-07-26T11:00:00.000Z'),
    });
    const deleting = fixture({
      key: { role: 'delete', autoApproveDeleteRequests: true },
    });
    deleting.models.Video.findOne.mockResolvedValue({
      id: 91,
      youtubeId,
      normalized_rating: 'TV-Y',
      removed: false,
    });
    deleting.models.ExternalRequest.findOne.mockResolvedValue(stale);

    const result = await deleting.service.createDeleteVideoRequest(deleting.key, {
      youtubeId,
      channelId: 8,
    });

    expect(deleting.videoDeleter.deleteVideoById).toHaveBeenCalledWith(
      91,
      expect.objectContaining({ transaction: deleting.transaction })
    );
    expect(result).toMatchObject({
      outcome: 'duplicate',
      request: { type: 'delete_video', status: 'completed' },
    });
  });

  test('reconciles a processing deletion after its video is absent', async () => {
    const deleting = fixture({ key: { role: 'delete' } });
    const processing = record({
      request_type: 'delete_video',
      status: 'processing',
      decided_at: timestamp,
    });
    deleting.models.ExternalRequest.findAndCountAll.mockResolvedValue({
      rows: [processing],
      count: 1,
    });
    deleting.models.Video.findAll.mockResolvedValue([]);

    const result = await deleting.service.listRequests(deleting.key);

    expect(processing.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      active_dedupe_key: null,
      completed_at: timestamp,
    }));
    expect(result.data[0]).toMatchObject({
      type: 'delete_video',
      status: 'completed',
    });
  });

  test('marks queue failures terminal so a retry is possible', async () => {
    const queueError = new Error('secret executor failure');
    const failed = fixture({
      key: { autoApproveVideoRequests: true },
      executor: jest.fn().mockRejectedValue(queueError),
    });
    const result = await failed.service.createVideoRequest(
      failed.key, { youtubeId, channelId: 8 }
    );
    expect(failed.created.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      active_dedupe_key: null,
      message: 'Download could not be queued',
    }));
    expect(result.request).toMatchObject({
      status: 'failed',
      message: 'Download could not be queued',
    });
    expect(result.request.message).not.toContain('secret');
  });

  test('lists only the calling key and lazily reconciles completed downloads', async () => {
    const processing = record({ status: 'processing' });
    const own = fixture();
    own.models.ExternalRequest.findAndCountAll.mockResolvedValue({ rows: [processing], count: 1 });
    own.models.Video.findAll.mockResolvedValue([{ youtubeId }]);
    const result = await own.service.listRequests(own.key, {
      page: '1', pageSize: '10',
    });
    expect(own.models.ExternalRequest.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { api_key_id: 4 },
      limit: 10,
      offset: 0,
    }));
    expect(processing.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      active_dedupe_key: null,
      completed_at: timestamp,
    }));
    expect(result.data[0].status).toBe('completed');
  });

  test.each(['Error', 'Killed', 'Terminated', 'Complete', 'Complete with Warnings'])(
    'reconciles a %s downloader job to a retryable failed request',
    async (jobStatus) => {
      const processing = record({ status: 'processing', job_id: 'job-123' });
      const own = fixture();
      own.models.ExternalRequest.findAndCountAll.mockResolvedValue({ rows: [processing], count: 1 });
      own.models.Job.findAll.mockResolvedValue([{ id: 'job-123', status: jobStatus }]);
      const result = await own.service.listRequests(own.key, {});
      expect(own.models.Job.findAll).toHaveBeenCalledWith({
        where: { id: ['job-123'] },
        attributes: ['id', 'status'],
      });
      expect(processing.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'failed',
        active_dedupe_key: null,
        message: 'Download did not complete',
      }));
      expect(result.data[0]).toMatchObject({
        status: 'failed',
        message: 'Download did not complete',
      });
    }
  );

  test('reconciles a status-filtered page and requeries its count', async () => {
    const stale = record({ status: 'processing', job_id: 'job-123' });
    const own = fixture();
    own.models.Job.findAll.mockResolvedValue([{ id: 'job-123', status: 'Error' }]);
    own.models.ExternalRequest.findAndCountAll
      .mockResolvedValueOnce({ rows: [stale], count: 1 })
      .mockResolvedValueOnce({ rows: [], count: 0 });

    const result = await own.service.listRequests(own.key, { status: 'processing' });

    expect(stale.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    expect(own.models.ExternalRequest.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { api_key_id: 4, status: 'processing' } })
    );
    expect(result).toMatchObject({
      data: [],
      pagination: { total: 0, totalPages: 0 },
    });
  });

  test('validates scope, body fields, paging, and status allowlists', async () => {
    const { service, key } = fixture();
    await expect(service.createVideoRequest(
      { ...key, role: 'view' }, { youtubeId, channelId: 8 }
    )).rejects.toBeInstanceOf(RequestError);
    await expect(service.createVideoRequest(
      { ...key, allowVideoRequests: false }, { youtubeId, channelId: 8 }
    )).rejects.toThrow('video:request scope is required');
    await expect(service.createChannelRequest(
      { ...key, allowChannelRequests: false }, { channelUrl: 'youtube.com/@safe' }
    )).rejects.toThrow('channel:request scope is required');
    await expect(service.createDeleteVideoRequest(
      { ...key, role: 'delete', allowDeleteVideoRequests: false },
      { youtubeId, channelId: 8 }
    )).rejects.toThrow('video:delete scope is required');
    await expect(service.createVideoRequest(
      key, { youtubeId, channelId: 8, resolution: '2160' }
    )).rejects.toThrow('unsupported');
    await expect(service.createVideoRequest(key, { youtubeId })).rejects.toThrow('channelId is required');
    await expect(service.listRequests(key, { status: 'DROP TABLE' })).rejects.toThrow('status');
    await expect(service.listRequests(key, { pageSize: '101' })).rejects.toThrow('pageSize');
  });

  test('lists administrator requests with safe joined metadata and filters', async () => {
    const listed = record({
      status: 'pending',
      apiKey: {
        id: 4, name: 'External Client', key_prefix: 'abcd1234', key_hash: 'must-not-leak',
        role: 'request', is_active: true, revoked_at: null,
      },
      channel: {
        id: 8, channel_id: 'UC1234567890123456789012', title: 'Safe Channel',
        default_rating: 'TV-PG',
      },
      job: null,
    });
    const admin = fixture();
    admin.models.ExternalRequest.findAndCountAll.mockResolvedValue({ rows: [listed], count: 1 });
    admin.models.ApiKey.findAll.mockResolvedValue([listed.apiKey]);
    admin.models.ChannelVideo.findAll.mockResolvedValue([{
      youtube_id: youtubeId,
      channel_id: 'UC1234567890123456789012',
      title: 'Safe video',
      media_type: 'video',
    }]);
    admin.models.Video.findAll.mockResolvedValue([{
      youtubeId,
      normalized_rating: 'TV-Y',
    }]);

    const result = await admin.service.listAdminRequests({
      page: '2', pageSize: '10', status: 'pending', apiKeyId: '4',
    });

    expect(admin.models.ExternalRequest.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'pending', api_key_id: 4 },
        limit: 10,
        offset: 10,
        distinct: true,
      })
    );
    const keyInclude = admin.models.ExternalRequest.findAndCountAll.mock.calls[0][0]
      .include.find((item) => item.as === 'apiKey');
    expect(keyInclude.attributes).not.toContain('key_hash');
    expect(result.data[0]).toMatchObject({
      requester: { id: 4, name: 'External Client', keyPrefix: 'abcd1234' },
      target: {
        youtubeId,
        channelId: 8,
        youtubeChannelId: 'UC1234567890123456789012',
        channelTitle: 'Safe Channel',
        title: 'Safe video',
        mediaType: 'video',
        rating: 'TV-PG',
        contentRating: 'TV-Y',
      },
      job: null,
    });
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
    expect(admin.models.Video.findAll).toHaveBeenCalledWith({
      where: { youtubeId: [youtubeId] },
      attributes: ['youtubeId', 'normalized_rating'],
    });
  });

  test('approves a pending request only after current policy revalidation and queue acceptance', async () => {
    const pending = record();
    const hydrated = Object.assign(pending, {
      apiKey: {
        id: 4, name: 'External Client', key_prefix: 'abcd1234', role: 'request',
        is_active: true, revoked_at: null,
      },
      channel: {
        id: 8, channel_id: 'UC1234567890123456789012', title: 'Safe Channel',
      },
      job: {
        id: pending.id, status: 'In Progress', jobType: 'External video request',
        timeCreated: timestamp, timeInitiated: timestamp,
      },
    });
    const approved = fixture();
    approved.models.ExternalRequest.findOne
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(hydrated);
    approved.models.ChannelVideo.findAll.mockResolvedValue([{
      youtube_id: youtubeId,
      channel_id: 'UC1234567890123456789012',
      title: 'Safe video',
      media_type: 'video',
    }]);

    const result = await approved.service.reviewVideoRequest(pending.id, 'approve', {});

    expect(approved.models.ApiKey.findByPk).toHaveBeenCalledWith(4, expect.objectContaining({
      transaction: approved.transaction,
      lock: 'UPDATE',
      attributes: expect.not.arrayContaining(['key_hash']),
    }));
    expect(approved.executor).toHaveBeenCalledWith({
      body: expect.objectContaining({
        urls: [`https://www.youtube.com/watch?v=${youtubeId}`],
        channelId: 'UC1234567890123456789012',
        externalRequestId: pending.id,
      }),
    });
    expect(pending.update.mock.calls.map(([values]) => values.status)).toEqual([
      'approved', 'processing',
    ]);
    expect(result.status).toBe('processing');
    expect(result.job.id).toBe(pending.id);
  });

  test('fails approval closed when the requester key is revoked', async () => {
    const pending = record();
    const hydrated = Object.assign(pending, {
      apiKey: {
        id: 4, name: 'External Client', key_prefix: 'abcd1234', role: 'request',
        is_active: false, revoked_at: timestamp,
      },
      channel: {
        id: 8, channel_id: 'UC1234567890123456789012', title: 'Safe Channel',
      },
      job: null,
    });
    const revoked = fixture();
    revoked.models.ApiKey.findByPk.mockResolvedValue({
      id: 4,
      name: 'External Client',
      role: 'request',
      is_active: false,
      revoked_at: timestamp,
      max_rating_level: 2,
      allow_unrated: false,
      allowed_media_types: ['video'],
    });
    revoked.models.ExternalRequest.findOne
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(hydrated);
    revoked.models.ChannelVideo.findAll.mockResolvedValue([]);

    const result = await revoked.service.reviewVideoRequest(pending.id, 'approve', {});

    expect(revoked.executor).not.toHaveBeenCalled();
    expect(pending.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      active_dedupe_key: null,
      message: 'Request is no longer eligible',
    }), { transaction: revoked.transaction });
    expect(result.status).toBe('failed');
  });

  test('rejects pending requests with a bounded sanitized reason and clears dedupe', async () => {
    const pending = record();
    const hydrated = Object.assign(pending, {
      apiKey: {
        id: 4, name: 'External Client', key_prefix: 'abcd1234', role: 'request',
        is_active: true, revoked_at: null,
      },
      channel: {
        id: 8, channel_id: 'UC1234567890123456789012', title: 'Safe Channel',
      },
      job: null,
    });
    const rejected = fixture();
    rejected.models.ExternalRequest.findOne
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(hydrated);
    rejected.models.ChannelVideo.findAll.mockResolvedValue([]);

    const result = await rejected.service.reviewVideoRequest(
      pending.id,
      'reject',
      { reason: '  Not\u0000 eligible \n right now.  ' }
    );

    expect(pending.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'rejected',
      active_dedupe_key: null,
      message: 'Not eligible right now.',
      decided_at: timestamp,
    }), { transaction: rejected.transaction });
    expect(result.status).toBe('rejected');
  });

  test('rejects non-monotonic review transitions and malformed reasons', async () => {
    const completed = fixture();
    completed.models.ExternalRequest.findOne.mockResolvedValue(record({ status: 'completed' }));
    await expect(completed.service.reviewVideoRequest(
      '9b89e5bc-8c90-4e72-b245-270fed2eacc2',
      'approve',
      {}
    )).rejects.toMatchObject({ status: 409 });
    await expect(completed.service.reviewVideoRequest(
      '9b89e5bc-8c90-4e72-b245-270fed2eacc2',
      'reject',
      { reason: 'x'.repeat(301) }
    )).rejects.toThrow('reason');
  });
});
