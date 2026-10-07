const { RequestError } = require('../externalRequestService');
const { fixture, record, youtubeId } = require('./fixtures/externalRequests');

describe('external request service', () => {
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


});
