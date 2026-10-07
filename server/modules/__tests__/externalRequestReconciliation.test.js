const { fixture, record, timestamp, youtubeId } = require('./fixtures/externalRequests');

describe('external request reconciliation', () => {
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


});
