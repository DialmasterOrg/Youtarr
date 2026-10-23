const {
  createExternalRequestExecutor, EXTERNAL_REQUEST_JOB_LABEL,
} = require('../externalRequestExecutor');
const { RequestError } = require('../externalRequestPrimitives');
const { record, timestamp, youtubeId } = require('./fixtures/externalRequests');

const youtubeChannelId = 'UC1234567890123456789012';
const requestId = '9b89e5bc-8c90-4e72-b245-270fed2eacc2';

function apiKey(overrides = {}) {
  return {
    id: 4,
    name: 'External Client',
    autoApproveVideoRequests: true,
    autoApproveChannelRequests: true,
    autoApproveDeleteRequests: true,
    ...overrides,
  };
}

function setup({ rows = [], key = apiKey(), target, claimed = 1 } = {}) {
  const events = [];
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const channel = {
    id: 8, channel_id: youtubeChannelId, enabled: false, terminated_at: null,
    update: jest.fn(async function update(values) { Object.assign(this, values); }),
  };
  const models = {
    ExternalRequest: {
      findAll: jest.fn(async ({ where }) => (where.status === 'approved' ? rows : [])),
      update: jest.fn(async (values) => {
        events.push(['request.update', values.status || values.job_id]);
        return [claimed];
      }),
    },
    ApiKeyChannelGrant: { findOrCreate: jest.fn().mockResolvedValue([{ id: 1 }, true]) },
    Channel: { findOne: jest.fn().mockResolvedValue(channel) },
    Video: { findAll: jest.fn().mockResolvedValue([]) },
    Job: { findAll: jest.fn().mockResolvedValue([]), findByPk: jest.fn().mockResolvedValue(null) },
  };
  const deps = {
    models,
    sequelize: {
      transaction: jest.fn(async (callback) => {
        events.push(['transaction']);
        return callback(transaction);
      }),
    },
    now: () => timestamp,
    quotas: { reloadAuthorizedKey: jest.fn().mockResolvedValue(key) },
    validateTarget: jest.fn().mockResolvedValue(target || {
      channel: { channel_id: youtubeChannelId }, downloaded: null,
    }),
    workLimiter: { run: jest.fn((work) => work()) },
    downloader: jest.fn(async (_jobData, { jobId }) => jobId),
    channelProvisioner: {
      getChannelInfo: jest.fn(async () => {
        events.push(['getChannelInfo']);
        return { channel_id: youtubeChannelId };
      }),
    },
    videoDeleter: { deleteVideos: jest.fn(async (ids) => ({ success: true, deleted: ids, failed: [] })) },
    storageGuard: { isPausedError: (error) => error?.code === 'DOWNLOADS_PAUSED' },
    jobLookup: jest.fn(() => null),
    logger: { warn: jest.fn(), error: jest.fn() },
  };
  return { executor: createExternalRequestExecutor(deps), deps, models, channel, transaction, events };
}

const approved = (overrides = {}) => record({
  status: 'approved', approval_source: 'admin', decided_at: timestamp, ...overrides,
});

describe('external request executor', () => {
  describe('video requests', () => {
    test('queues the canonical URL with the request id as the job id', async () => {
      const row = approved();
      const { executor, deps, models } = setup({ rows: [row] });

      await executor.runOnce();

      expect(deps.downloader).toHaveBeenCalledWith({
        urls: [`https://www.youtube.com/watch?v=${youtubeId}`],
        channelId: youtubeChannelId,
        ownerChannelMap: { [youtubeId]: youtubeChannelId },
        initiatedBy: { type: 'api_key', name: 'External Client' },
        jobLabel: EXTERNAL_REQUEST_JOB_LABEL,
      }, { jobId: requestId });
      expect(models.ExternalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ job_id: requestId }),
        { where: { id: requestId, status: 'processing' } }
      );
    });

    test('runs without a transaction', async () => {
      const { executor, deps } = setup({ rows: [approved()] });
      await executor.runOnce();
      expect(deps.sequelize.transaction).not.toHaveBeenCalled();
    });

    test('fails an auto-approved request once the key stops auto-approving', async () => {
      const row = approved({ approval_source: 'auto' });
      const { executor, deps } = setup({
        rows: [row], key: apiKey({ autoApproveVideoRequests: false }),
      });

      await executor.runOnce();

      expect(deps.downloader).not.toHaveBeenCalled();
      expect(row.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'failed', message: 'Request is no longer eligible', active_dedupe_key: null,
      }));
    });

    test('runs an administrator-approved request whatever the auto-approval setting', async () => {
      const { executor, deps } = setup({
        rows: [approved()], key: apiKey({ autoApproveVideoRequests: false }),
      });
      await executor.runOnce();
      expect(deps.downloader).toHaveBeenCalled();
    });

    test('fails when the key lost access to the target', async () => {
      const row = approved();
      const { executor, deps } = setup({ rows: [row] });
      deps.validateTarget.mockRejectedValue(new RequestError('Video not found', 404));

      await executor.runOnce();

      expect(row.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'failed', message: 'Request is no longer eligible',
      }));
    });

    test('holds the request while downloads are paused', async () => {
      const row = approved();
      const { executor, deps } = setup({ rows: [row] });
      deps.downloader.mockRejectedValue(Object.assign(new Error('paused'), { code: 'DOWNLOADS_PAUSED' }));

      await executor.runOnce();

      expect(row.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'approved', message: 'Waiting for downloads to resume',
      }));
    });

    test('holds the request while another job downloads the same video', async () => {
      const row = approved();
      const { executor, deps } = setup({ rows: [row] });
      deps.downloader.mockResolvedValue({ queued: 0, acceptedIds: [], alreadyActiveIds: [youtubeId] });

      await executor.runOnce();

      expect(row.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'approved', message: 'Waiting for another download of this video to finish',
      }));
    });

    test('completes without downloading when the video is already on disk', async () => {
      const row = approved();
      const { executor, deps } = setup({
        rows: [row], target: { channel: { channel_id: youtubeChannelId }, downloaded: { id: 91 } },
      });

      await executor.runOnce();

      expect(deps.downloader).not.toHaveBeenCalled();
      expect(row.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'completed', message: 'Video is already downloaded',
      }));
    });

    test('does nothing when another sweep claimed the row first', async () => {
      const { executor, deps } = setup({ rows: [approved()], claimed: 0 });
      await executor.runOnce();
      expect(deps.downloader).not.toHaveBeenCalled();
    });
  });

  describe('channel requests', () => {
    const channelRow = (overrides = {}) => approved({
      request_type: 'channel', channel_id: null, youtube_id: null,
      channel_url: 'https://www.youtube.com/@safe', grant_to_requesting_key: true, ...overrides,
    });

    test('provisions outside the transaction and locks only for the final write', async () => {
      const { executor, events } = setup({ rows: [channelRow()] });
      await executor.runOnce();
      const order = events.map(([name]) => name).filter((name) => name !== 'request.update');
      expect(order).toEqual(['getChannelInfo', 'transaction']);
    });

    test('resolves the channel without enabling it, then enables and grants it', async () => {
      const row = channelRow();
      const { executor, deps, models, channel } = setup({ rows: [row] });

      await executor.runOnce();

      expect(deps.channelProvisioner.getChannelInfo).toHaveBeenCalledWith(
        'https://www.youtube.com/@safe', false, false, {}, { skipTabDetection: true }
      );
      expect(channel.enabled).toBe(true);
      expect(models.ApiKeyChannelGrant.findOrCreate).toHaveBeenCalledWith(expect.objectContaining({
        where: { api_key_id: 4, channel_id: 8 },
      }));
      expect(row.status).toBe('completed');
    });

    test('fails a terminated channel without re-enabling it', async () => {
      const row = channelRow();
      const { executor, channel } = setup({ rows: [row] });
      channel.terminated_at = timestamp;

      await executor.runOnce();

      expect(channel.update).not.toHaveBeenCalled();
      expect(row.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'failed', message: 'Channel is unavailable',
      }));
    });

    test('skips the grant when the administrator declined it', async () => {
      const { executor, models } = setup({ rows: [channelRow({ grant_to_requesting_key: false })] });
      await executor.runOnce();
      expect(models.ApiKeyChannelGrant.findOrCreate).not.toHaveBeenCalled();
    });

    test('holds the request when the work queue is full', async () => {
      const row = channelRow();
      const { executor, deps } = setup({ rows: [row] });
      deps.workLimiter.run.mockRejectedValue(Object.assign(new Error('full'), { name: 'ExternalWorkLimitError' }));

      await executor.runOnce();

      expect(row.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }));
    });
  });

  describe('delete requests', () => {
    const deleteRow = () => approved({ request_type: 'delete_video' });
    const downloadedTarget = { channel: { channel_id: youtubeChannelId }, downloaded: { id: 91 } };

    test('deletes through deleteVideos outside any transaction', async () => {
      const row = deleteRow();
      const { executor, deps } = setup({ rows: [row], target: downloadedTarget });

      await executor.runOnce();

      expect(deps.videoDeleter.deleteVideos).toHaveBeenCalledWith([91]);
      expect(deps.sequelize.transaction).not.toHaveBeenCalled();
      expect(row.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
    });

    test('completes when the video is already gone', async () => {
      const row = deleteRow();
      const { executor, deps } = setup({ rows: [row] });

      await executor.runOnce();

      expect(deps.videoDeleter.deleteVideos).not.toHaveBeenCalled();
      expect(row.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'completed', message: 'Video is already deleted',
      }));
    });

    test('fails when the deletion is refused', async () => {
      const row = deleteRow();
      const { executor, deps } = setup({ rows: [row], target: downloadedTarget });
      deps.videoDeleter.deleteVideos.mockResolvedValue({
        success: false, deleted: [], failed: [{ videoId: 91, error: 'Library is unavailable' }],
      });

      await executor.runOnce();

      expect(row.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'failed', message: 'Video could not be deleted',
      }));
    });
  });

  describe('recovery and completion', () => {
    test('returns an interrupted channel request to the approved queue', async () => {
      const stale = record({ request_type: 'channel', status: 'processing', updated_at: new Date(0) });
      const { executor, models } = setup();
      models.ExternalRequest.findAll.mockImplementation(async ({ where }) => (
        where.status === 'processing' && where.updated_at ? [stale] : []
      ));

      await executor.runOnce();

      expect(models.ExternalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' }),
        { where: { id: stale.id, status: 'processing', updated_at: stale.updated_at } }
      );
    });

    test('adopts the job of a video request interrupted before recording it', async () => {
      const stale = record({ status: 'processing', job_id: null, updated_at: new Date(0) });
      const { executor, models } = setup();
      models.ExternalRequest.findAll.mockImplementation(async ({ where }) => (
        where.status === 'processing' && where.updated_at ? [stale] : []
      ));
      models.Job.findByPk.mockResolvedValue({ id: stale.id });

      await executor.runOnce();

      expect(models.ExternalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ job_id: stale.id }),
        { where: { id: stale.id, status: 'processing', job_id: null } }
      );
    });

    test('ignores jobs that did not come from an external request', async () => {
      const { executor, deps, models } = setup();
      deps.jobLookup.mockReturnValue({ jobType: 'Channel Downloads', status: 'Complete' });

      await executor.handleJobEnded({ jobId: 'job-1' });

      expect(models.ExternalRequest.findAll).not.toHaveBeenCalled();
    });

    test('closes a request as completed when its job ends with the video on disk', async () => {
      const processing = record({ status: 'processing', job_id: requestId });
      const { executor, deps, models } = setup();
      deps.jobLookup.mockReturnValue({ jobType: EXTERNAL_REQUEST_JOB_LABEL, status: 'Complete' });
      models.ExternalRequest.findAll.mockResolvedValue([processing]);
      models.Video.findAll.mockResolvedValue([{ youtubeId }]);

      await executor.handleJobEnded({ jobId: requestId });

      expect(models.ExternalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed', active_dedupe_key: null }),
        { where: { id: requestId, status: 'processing' } }
      );
    });

    test('closes a request as failed when its job ends without the video', async () => {
      const processing = record({ status: 'processing', job_id: requestId });
      const { executor, deps, models } = setup();
      deps.jobLookup.mockReturnValue({ jobType: EXTERNAL_REQUEST_JOB_LABEL, status: 'Error' });
      models.ExternalRequest.findAll.mockResolvedValue([processing]);

      await executor.handleJobEnded({ jobId: requestId });

      expect(models.ExternalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', message: 'Download did not complete' }),
        { where: { id: requestId, status: 'processing' } }
      );
    });

    test('the sweep closes a download whose job-ended event was missed', async () => {
      const processing = record({ status: 'processing', job_id: 'job-123' });
      const { executor, models } = setup();
      models.ExternalRequest.findAll.mockImplementation(async ({ where }) => (
        where.status === 'processing' && where.job_id ? [processing] : []
      ));
      models.Job.findAll.mockResolvedValue([{ id: 'job-123', status: 'Killed' }]);

      await executor.runOnce();

      expect(models.ExternalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
        { where: { id: processing.id, status: 'processing' } }
      );
    });

    test('the sweep fails a download whose job was lost entirely', async () => {
      const processing = record({ status: 'processing', job_id: 'job-123' });
      const { executor, models } = setup();
      models.ExternalRequest.findAll.mockImplementation(async ({ where }) => (
        where.status === 'processing' && where.job_id ? [processing] : []
      ));

      await executor.runOnce();

      expect(models.ExternalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', message: 'Download did not complete' }),
        { where: { id: processing.id, status: 'processing' } }
      );
    });

    test('wake runs approved requests without waiting for the timer', async () => {
      const rows = [approved()];
      const { executor, deps, models } = setup();
      models.ExternalRequest.findAll.mockImplementation(async ({ where }) => (
        where.status === 'approved' ? rows.splice(0) : []
      ));

      executor.wake();
      for (let tick = 0; tick < 20 && deps.downloader.mock.calls.length === 0; tick += 1) {
        await new Promise((resolve) => setImmediate(resolve));
      }

      expect(deps.downloader).toHaveBeenCalledTimes(1);
    });

    test('leaves a request alone while its job is still running', async () => {
      const processing = record({ status: 'processing', job_id: requestId });
      const { executor, deps, models } = setup();
      deps.jobLookup.mockReturnValue({ jobType: EXTERNAL_REQUEST_JOB_LABEL, status: 'In Progress' });
      models.ExternalRequest.findAll.mockImplementation(async ({ where }) => (
        where.status === 'processing' && where.job_id ? [processing] : []
      ));

      await executor.runOnce();

      expect(models.ExternalRequest.update).not.toHaveBeenCalled();
    });
  });
});
