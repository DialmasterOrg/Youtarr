const { Op } = require('sequelize');
const { createExternalRequestReconciliation } = require('../externalRequestReconciliation');

const youtubeId = 'abcdefghijk';
function setup({ stored = false } = {}) {
  const jobs = new Map();
  const request = { id: 'original', job_id: 'original', youtube_id: youtubeId,
    request_type: 'video', status: 'processing', active_dedupe_key: 'dedupe' };
  const models = {
    ExternalRequest: { update: jest.fn(async (values, { where }) => {
      if (where.job_id !== request.job_id || request.status !== where.status) return [0];
      Object.assign(request, values);
      return [1];
    }) },
    Video: { findAll: jest.fn().mockResolvedValue([]) },
    Job: { findAll: jest.fn(async ({ where }) => where.id[Op.in].flatMap(id => {
      const job = jobs.get(id);
      return job ? [{ id, status: job.status, aux_data: JSON.stringify(job.data) }] : [];
    })) },
  };
  const api = createExternalRequestReconciliation({ models, now: () => new Date(),
    jobLookup: id => stored ? null : jobs.get(id) });
  const handoff = (next, id = youtubeId) => ({ status: 'Error', data: { failedVideos: [
    { youtubeId: id, autoRetryQueued: true, autoRetryJobId: next },
  ] } });
  const resolve = () => api.resolveVideoRequests([{ ...request }]);
  return { jobs, models, request, handoff, resolve, api };
}

describe.each([false, true])('retry reconciliation (stored jobs: %s)', stored => {
  test('keeps pending retries processing with dedupe and closes the successful retry', async () => {
    const { jobs, models, request, handoff, resolve } = setup({ stored });
    jobs.set('original', handoff('retry-1'));
    jobs.set('retry-1', { status: 'Pending' });
    await resolve();
    expect(request).toMatchObject({ job_id: 'retry-1', status: 'processing', active_dedupe_key: 'dedupe' });
    jobs.set('retry-1', { status: 'Complete' });
    models.Video.findAll.mockResolvedValue([{ youtubeId }]);
    await resolve();
    expect(request).toMatchObject({ status: 'completed', active_dedupe_key: null });
  });

  test.each(['Error', 'Killed', 'Terminated'])('fails only after the last retry ends in %s', async status => {
    const { jobs, request, handoff, resolve } = setup({ stored });
    jobs.set('original', handoff('retry-1'));
    jobs.set('retry-1', handoff('retry-2'));
    jobs.set('retry-2', { status: 'In Progress' });
    await resolve();
    expect(request).toMatchObject({ job_id: 'retry-2', status: 'processing', active_dedupe_key: 'dedupe' });
    jobs.set('retry-2', { status });
    await resolve();
    expect(request).toMatchObject({ status: 'failed', active_dedupe_key: null, message: 'Download did not complete' });
  });

  test('completes when a retry persists its video between the initial read and terminal lookup', async () => {
    const { jobs, models, request, handoff, resolve } = setup({ stored });
    jobs.set('original', handoff('retry-1'));
    jobs.set('retry-1', { status: 'Complete' });
    models.Video.findAll.mockResolvedValueOnce([]).mockResolvedValue([{ youtubeId }]);
    await resolve();
    expect(models.Video.findAll).toHaveBeenCalledTimes(2);
    expect(request).toMatchObject({ status: 'completed', active_dedupe_key: null });
  });

  test('does not follow a handoff for a different video in a mixed job', async () => {
    const { jobs, request, handoff, resolve } = setup({ stored });
    jobs.set('original', handoff('unrelated', 'lmnopqrstuv'));
    jobs.set('unrelated', { status: 'Pending' });
    await resolve();
    expect(request.status).toBe('failed');
  });

  test('fails when the queued retry was lost entirely', async () => {
    const { jobs, request, handoff, resolve } = setup({ stored });
    jobs.set('original', handoff('lost-retry'));
    await resolve();
    expect(request).toMatchObject({ status: 'failed', job_id: 'lost-retry', active_dedupe_key: null });
  });

  test('the maximum retry chain can still be pending', async () => {
    const { jobs, request, handoff, resolve } = setup({ stored });
    jobs.set('original', handoff('retry-1'));
    jobs.set('retry-1', handoff('retry-2'));
    jobs.set('retry-2', handoff('retry-3'));
    jobs.set('retry-3', { status: 'Pending' });
    await resolve();
    expect(request).toMatchObject({ status: 'processing', job_id: 'retry-3' });
  });

  test('does not hang on cyclic handoffs', async () => {
    const { jobs, request, handoff, resolve } = setup({ stored });
    jobs.set('original', handoff('retry-1'));
    jobs.set('retry-1', handoff('original'));
    await resolve();
    expect(request.status).toBe('failed');
  });

  test('handles a retry that ended before the original event was processed', async () => {
    const { jobs, request, handoff, resolve } = setup({ stored });
    jobs.set('original', handoff('retry-1'));
    jobs.set('retry-1', { status: 'Error' });
    await resolve();
    expect(request).toMatchObject({ status: 'failed', job_id: 'retry-1' });
  });
});

test('a stale event cannot close or overwrite a newer retry handoff', async () => {
  const { jobs, request, models, api } = setup();
  const stale = { ...request };
  request.job_id = 'retry-1';
  jobs.set('original', { status: 'Error' });
  await api.resolveVideoRequests([stale], { endedJobIds: ['original'] });
  expect(models.ExternalRequest.update).toHaveBeenCalled();
  expect(request).toMatchObject({ job_id: 'retry-1', status: 'processing', active_dedupe_key: 'dedupe' });
});
