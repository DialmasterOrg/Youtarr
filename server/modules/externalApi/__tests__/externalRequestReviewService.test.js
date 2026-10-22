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

  function hydrate(pending, apiKey = {}) {
    return Object.assign(pending, {
      apiKey: {
        id: 4, name: 'External Client', key_prefix: 'abcd1234', role: 'request',
        is_active: true, revoked_at: null, ...apiKey,
      },
      channel: { id: 8, channel_id: 'UC1234567890123456789012', title: 'Safe Channel' },
      job: null,
    });
  }

  function reviewing(pending, overrides = {}) {
    const review = fixture(overrides);
    review.models.ExternalRequest.findByPk.mockResolvedValue(pending);
    review.models.ExternalRequest.findOne.mockResolvedValue(hydrate(pending));
    return review;
  }

  test('approval records the decision and returns without running the request', async () => {
    const pending = record();
    const approved = reviewing(pending);

    const result = await approved.service.reviewRequest(pending.id, 'approve', {});

    expect(approved.models.ApiKey.findByPk).toHaveBeenCalledWith(4, expect.objectContaining({
      transaction: approved.transaction,
      lock: 'UPDATE',
      attributes: expect.not.arrayContaining(['key_hash']),
    }));
    expect(pending.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'approved',
      approval_source: 'admin',
      decided_at: timestamp,
    }), { transaction: approved.transaction });
    expect(approved.downloader).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'approved', approvalSource: 'admin' });
  });

  test('approval completes a video request whose video was downloaded meanwhile', async () => {
    const pending = record();
    const approved = reviewing(pending);
    approved.models.Video.findOne.mockResolvedValue({
      id: 91, youtubeId, normalized_rating: 'TV-Y', removed: false,
    });

    const result = await approved.service.reviewRequest(pending.id, 'approve', {});

    expect(result).toMatchObject({ status: 'completed', message: 'Video is already downloaded' });
  });

  test('approving an already approved request is a no-op', async () => {
    const pending = record({ status: 'approved', decided_at: timestamp });
    const repeated = reviewing(pending);

    const result = await repeated.service.reviewRequest(pending.id, 'approve', {});

    expect(pending.update).not.toHaveBeenCalled();
    expect(result.status).toBe('approved');
  });

  test('a repeated channel approval may not change the grant decision', async () => {
    const pending = record({
      request_type: 'channel', status: 'approved', channel_id: null, youtube_id: null,
      channel_url: 'https://www.youtube.com/@safe', grant_to_requesting_key: true,
    });
    const repeated = reviewing(pending);

    await expect(repeated.service.reviewRequest(
      pending.id, 'approve', { grantToRequestingKey: false }
    )).rejects.toMatchObject({ status: 409 });
  });

  test('channel approval records the grant decision', async () => {
    const pending = record({
      request_type: 'channel', channel_id: null, youtube_id: null,
      channel_url: 'https://www.youtube.com/@safe',
    });
    const approved = reviewing(pending);

    await approved.service.reviewRequest(pending.id, 'approve', { grantToRequestingKey: false });

    expect(pending.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'approved', grant_to_requesting_key: false,
    }), { transaction: approved.transaction });
    expect(approved.channelProvisioner.getChannelInfo).not.toHaveBeenCalled();
  });

  test('fails approval closed when the requester key is revoked', async () => {
    const pending = record();
    const revoked = reviewing(pending);
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

    const result = await revoked.service.reviewRequest(pending.id, 'approve', {});

    expect(pending.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      active_dedupe_key: null,
      message: 'Request is no longer eligible',
    }), { transaction: revoked.transaction });
    expect(result.status).toBe('failed');
  });

  test('rejects pending requests with a bounded sanitized reason and clears dedupe', async () => {
    const pending = record();
    const rejected = reviewing(pending);

    const result = await rejected.service.reviewRequest(
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
    const completed = reviewing(record({ status: 'completed' }));
    await expect(completed.service.reviewRequest(
      '9b89e5bc-8c90-4e72-b245-270fed2eacc2',
      'approve',
      {}
    )).rejects.toMatchObject({ status: 409 });
    await expect(completed.service.reviewRequest(
      '9b89e5bc-8c90-4e72-b245-270fed2eacc2',
      'reject',
      { reason: 'x'.repeat(301) }
    )).rejects.toThrow('reason');
  });
});
