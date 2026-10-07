const { fixture, record, timestamp, youtubeId } = require('./fixtures/externalRequests');

describe('external request reviewservice', () => {
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
