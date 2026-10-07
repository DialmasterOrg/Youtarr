const { fixture, record, timestamp, youtubeId } = require('./fixtures/externalRequests');

describe('external request execution', () => {
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
        jobLabel: 'Manually Added Urls (external request)',
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
    expect(limited.created.status).toBe('pending');
    expect(limited.created.active_dedupe_key).toBe(`4:video:${youtubeId}`);
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
    retry.models.ExternalRequest.findByPk.mockResolvedValue(interrupted);
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
    }), { transaction: retry.transaction });
    expect(result).toMatchObject({
      outcome: 'duplicate',
      request: { status: 'processing' },
    });
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


});
