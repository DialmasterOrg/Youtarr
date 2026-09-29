/* eslint-env jest */
jest.mock('../../../logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const { waitForSweepEnd } = require('../sweepCompletion');

const POLL_MS = 1000;
const MAX_MS = 60_000;
const FINISHED_AT = new Date('2026-09-28T16:21:17.000Z');

const job = (id, status) => ({ id, status, reporting: !['Pending', 'In Progress'].includes(status) });

// Unreported jobs with their live status, like downloadRunTracker.
function fakeTracker({ jobs = [], finished = null, active = true } = {}) {
  const state = { jobs, finished, active, listeners: [] };
  return {
    onRunFinished: jest.fn((runId, listener) => {
      state.listeners.push(listener);
      return () => { state.listeners = state.listeners.filter((l) => l !== listener); };
    }),
    getFinishedRun: jest.fn(() => state.finished),
    isActive: jest.fn(() => state.active),
    getUnreportedJobs: jest.fn(() => state.jobs),
    getTotals: jest.fn(() => ({ totalDownloaded: 1 })),
    setJobs: (next) => { state.jobs = next; },
    finish: (entry) => {
      state.finished = entry;
      state.active = false;
      state.jobs = [];
      state.listeners.slice().forEach((listener) => listener(entry));
    },
    listenerCount: () => state.listeners.length,
  };
}

const wait = (tracker, isPaused = () => false) => waitForSweepEnd({
  runId: 'run-1', tracker, isPaused, pollIntervalMs: POLL_MS, maxWaitMs: MAX_MS,
});

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('ends at once with the tracker\'s end time when the sweep already finished', async () => {
  const tracker = fakeTracker({ finished: { finishedAt: FINISHED_AT, totals: { totalDownloaded: 3 } } });
  await expect(wait(tracker)).resolves.toEqual({
    endedBy: 'finished', finishedAt: FINISHED_AT, totals: { totalDownloaded: 3 },
  });
  expect(jest.getTimerCount()).toBe(0);
});

test('ends when the tracker reports the sweep finished, and stops checking', async () => {
  const tracker = fakeTracker({ jobs: [job('j1', 'In Progress')] });
  const result = wait(tracker);
  tracker.finish({ finishedAt: FINISHED_AT, totals: { totalDownloaded: 2 } });
  await expect(result).resolves.toMatchObject({ endedBy: 'finished', finishedAt: FINISHED_AT });
  expect(jest.getTimerCount()).toBe(0);
  expect(tracker.listenerCount()).toBe(0);
});

test('leaves a job that ended without reporting to the tracker', async () => {
  const tracker = fakeTracker({ jobs: [job('j1', 'Error')] });
  const onEnd = jest.fn();
  wait(tracker).then(onEnd);
  await jest.advanceTimersByTimeAsync(10 * POLL_MS);
  expect(onEnd).not.toHaveBeenCalled();

  tracker.finish({ finishedAt: FINISHED_AT, totals: { jobIssues: [{ status: 'Error' }] } });
  await jest.advanceTimersByTimeAsync(0);
  expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ endedBy: 'finished', finishedAt: FINISHED_AT }));
});

test('ends at once when the tracker knows neither the run nor its end', async () => {
  const tracker = fakeTracker({ active: false });
  await expect(wait(tracker)).resolves.toMatchObject({ endedBy: 'idle' });
  expect(jest.getTimerCount()).toBe(0);
});

test('ends at a storage pause when the rest of the sweep is only queued', async () => {
  const tracker = fakeTracker({ jobs: [job('j1', 'Pending'), job('j2', 'Pending')] });
  await expect(wait(tracker, () => true)).resolves.toMatchObject({ endedBy: 'paused', remainingJobs: 2 });
});

test('does not end at a storage pause while a job is still downloading', async () => {
  const tracker = fakeTracker({ jobs: [job('j1', 'In Progress'), job('j2', 'Pending')] });
  const onEnd = jest.fn();
  wait(tracker, () => true).then(onEnd);
  await jest.advanceTimersByTimeAsync(2 * POLL_MS);
  expect(onEnd).not.toHaveBeenCalled();
});

test('does not end at a storage pause while a finished job is still reporting', async () => {
  const tracker = fakeTracker({ jobs: [job('j1', 'Complete'), job('j2', 'Pending')] });
  const onEnd = jest.fn();
  wait(tracker, () => true).then(onEnd);
  await jest.advanceTimersByTimeAsync(2 * POLL_MS);
  expect(onEnd).not.toHaveBeenCalled();
  tracker.setJobs([job('j2', 'Pending')]);
  await jest.advanceTimersByTimeAsync(POLL_MS);
  expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ endedBy: 'paused', remainingJobs: 1 }));
});

test('gives up after the maximum wait and stops checking', async () => {
  const tracker = fakeTracker({ jobs: [job('j1', 'In Progress')] });
  const onEnd = jest.fn();
  wait(tracker).then(onEnd);
  await jest.advanceTimersByTimeAsync(MAX_MS);
  expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ endedBy: 'timeout', remainingJobs: 1 }));
  expect(jest.getTimerCount()).toBe(0);
});

test('still ends when the tracker throws', async () => {
  const tracker = fakeTracker();
  tracker.getUnreportedJobs.mockImplementation(() => { throw new Error('boom'); });
  tracker.getTotals.mockImplementation(() => { throw new Error('boom'); });
  await expect(wait(tracker)).resolves.toMatchObject({ endedBy: 'error', error: 'boom', totals: null });
  expect(jest.getTimerCount()).toBe(0);
});

test('still ends when listening for the finish throws', async () => {
  const tracker = fakeTracker({ finished: { finishedAt: FINISHED_AT, totals: null } });
  tracker.onRunFinished.mockImplementation(() => { throw new Error('boom'); });
  await expect(wait(tracker)).resolves.toMatchObject({ endedBy: 'finished' });
});
