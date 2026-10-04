import {
  describeDurationPhrase, describeLastRunBrief, describeNextRun, describeRunDurationBrief, describeRunNowBlockBrief,
  describeTaskState, formatDuration, formatRunDuration, runDurationMs, summarizeTasks,
} from '../scheduleDisplay';
import { ScheduleRun, ScheduleTaskStatus } from '../../../hooks/useScheduleStatus';

const NOW = Date.parse('2026-09-28T12:00:00.000Z');
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const status = (overrides: Partial<ScheduleTaskStatus> = {}): ScheduleTaskStatus => ({
  key: 'autoRemovalFrequency',
  label: 'Automatic video cleanup',
  enabled: true,
  active: true,
  expression: '0 2 * * *',
  error: null,
  running: false,
  nextRunAt: at(3 * HOUR + 25 * MINUTE),
  lastRun: null,
  runNow: { available: true, reason: null, message: null, availableAt: null },
  ...overrides,
});

const run = (overrides: Partial<ScheduleRun> = {}): ScheduleRun => ({
  id: 1, taskKey: 'autoRemovalFrequency', trigger: 'scheduled', status: 'success', outcome: 'completed',
  message: null, details: null, startedAt: at(-35 * MINUTE), finishedAt: at(-34 * MINUTE),
  ...overrides,
});

describe('formatDuration', () => {
  test.each([
    [12 * MINUTE, '12m'],
    [3 * HOUR, '3h'],
    [3 * HOUR + 25 * MINUTE, '3h 25m'],
    [50 * HOUR, '2d 2h'],
    [48 * HOUR, '2d'],
  ])('formats %d ms as %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe('describeTaskState', () => {
  test('is unknown until the status loads', () => {
    expect(describeTaskState(undefined, false)).toEqual({ tone: 'unknown', label: null });
  });

  test('labels a running task, including one only the run-now probe reports', () => {
    expect(describeTaskState(status({ running: true }), false)).toEqual({ tone: 'running', label: 'Running' });
    expect(describeTaskState(status({
      runNow: { available: false, reason: 'running', message: null, availableAt: null },
    }), false).label).toBe('Running');
  });

  test('labels a platform-managed task', () => {
    expect(describeTaskState(status(), true)).toEqual({ tone: 'off', label: 'Managed' });
  });

  test('flags an unscheduled task and a rejected edit differently', () => {
    expect(describeTaskState(status({ active: false, error: 'bad' }), false)).toEqual({ tone: 'error', label: 'Not scheduled' });
    expect(describeTaskState(status({ error: 'bad' }), false)).toEqual({ tone: 'warning', label: 'Not applied' });
  });

  test('labels an inactive task as off', () => {
    expect(describeTaskState(status({ active: false, nextRunAt: null }), false)).toEqual({ tone: 'off', label: 'Off' });
  });

  test('colors a failed or partial last run without a label', () => {
    expect(describeTaskState(status({ lastRun: run({ status: 'error', outcome: 'error' }) }), false))
      .toEqual({ tone: 'error', label: null });
    expect(describeTaskState(status({ lastRun: run({ status: 'error', outcome: 'partial' }) }), false))
      .toEqual({ tone: 'warning', label: null });
  });

  test('is quiet for a healthy task', () => {
    expect(describeTaskState(status({ lastRun: run() }), false)).toEqual({ tone: 'ok', label: null });
  });
});

describe('describeNextRun', () => {
  test('says how long until the next run', () => {
    expect(describeNextRun(status(), NOW)).toBe('Next in 3h 25m');
  });

  test('says when the next run is due within a minute', () => {
    expect(describeNextRun(status({ nextRunAt: at(20_000) }), NOW)).toBe('Next in under a minute');
  });

  test('says there is no upcoming run for an inactive task', () => {
    expect(describeNextRun(status({ active: false, nextRunAt: null }), NOW)).toBe('No upcoming run');
  });
});

describe('describeLastRunBrief', () => {
  test('says the task has never run', () => {
    expect(describeLastRunBrief(null, NOW).text).toBe('Never run');
  });

  test.each([
    [run(), 'Ran 35m ago', 'ok'],
    [run({ status: 'error', outcome: 'error' }), 'Failed 35m ago', 'error'],
    [run({ status: 'error', outcome: 'partial' }), 'Partly failed 35m ago', 'warning'],
    [run({ status: 'interrupted' }), 'Interrupted 35m ago', 'warning'],
    [run({ status: 'skipped' }), 'Skipped 35m ago', 'ok'],
    [run({ status: 'running', startedAt: at(-2 * MINUTE) }), 'Started 2m ago', 'running'],
  ])('describes %o', (lastRun, text, tone) => {
    expect(describeLastRunBrief(lastRun, NOW)).toEqual({ text, tone });
  });

  test('says just now for a run under a minute old', () => {
    expect(describeLastRunBrief(run({ startedAt: at(-10_000) }), NOW).text).toBe('Ran just now');
  });
});

describe('describeRunNowBlockBrief', () => {
  test('is null while Run now is available', () => {
    expect(describeRunNowBlockBrief(status())).toBeNull();
  });

  test('gives a short reason for a blocked task', () => {
    expect(describeRunNowBlockBrief(status({
      runNow: { available: false, reason: 'downloads-paused', message: 'Downloads are paused.', availableAt: null },
    }))).toBe('Run now unavailable: downloads are paused');
  });

  test('says when downloads are being moved', () => {
    expect(describeRunNowBlockBrief(status({
      runNow: { available: false, reason: 'reorganizing', message: 'Waiting for the reorganize.', availableAt: null },
    }))).toBe('Run now unavailable: downloads are being moved');
  });

  test('leaves out reasons the row already shows', () => {
    expect(describeRunNowBlockBrief(status({
      runNow: { available: false, reason: 'disabled', message: null, availableAt: null },
    }))).toBeNull();
  });
});

describe('summarizeTasks', () => {
  test('is empty before any status loads', () => {
    expect(summarizeTasks([], NOW)).toEqual([]);
  });

  test('counts tasks, running and failed ones, and names the next run', () => {
    const parts = summarizeTasks([
      status({ key: 'videoRescanFrequency', label: 'Rescan files on disk', nextRunAt: at(9 * MINUTE) }),
      status({ running: true }),
      status({ key: 'watchStatusSyncFrequency', label: 'Watch status sync', lastRun: run({ status: 'error' }) }),
    ], NOW);
    expect(parts).toEqual([
      { text: '3 tasks' },
      { text: '1 running', tone: 'running' },
      { text: '1 failed last run', tone: 'error' },
      { text: 'next: Rescan files on disk in 9m' },
    ]);
  });

  test('says nothing is scheduled when no task is active', () => {
    const parts = summarizeTasks([status({ active: false, nextRunAt: null })], NOW);
    expect(parts[parts.length - 1]).toEqual({ text: 'nothing scheduled' });
  });
});

describe('formatRunDuration', () => {
  test.each([
    [400, 'under 1s'],
    [14_000, '14s'],
    [2 * MINUTE + 14_000, '2m 14s'],
    [2 * MINUTE, '2m'],
    [HOUR + 5 * MINUTE + 30_000, '1h 5m'],
  ])('formats %d ms as %s', (ms, expected) => {
    expect(formatRunDuration(ms)).toBe(expected);
  });
});

describe('runDurationMs', () => {
  test('measures a finished run', () => {
    expect(runDurationMs(run())).toBe(MINUTE);
  });

  test.each(['skipped', 'interrupted', 'running'] as const)('has no length for a %s run', (runStatus) => {
    expect(runDurationMs(run({ status: runStatus }))).toBeNull();
  });

  test('has no length without a finish time', () => {
    expect(runDurationMs(run({ finishedAt: null }))).toBeNull();
  });
});

describe('describeDurationPhrase', () => {
  test('says how long a completed run took', () => {
    expect(describeDurationPhrase(run())).toBe('in 1m');
  });

  test('says how long a failed run went before failing', () => {
    expect(describeDurationPhrase(run({ status: 'error' }))).toBe('after 1m');
  });
});

describe('describeRunDurationBrief', () => {
  test('says how long the last run took', () => {
    const last = run();
    expect(describeRunDurationBrief(status({ lastRun: last, lastFinishedRun: last }))).toBe('took 1m');
  });

  test('names the previous run when the last one did not finish', () => {
    const skipped = run({ id: 2, status: 'skipped', finishedAt: at(-35 * MINUTE) });
    expect(describeRunDurationBrief(status({ lastRun: skipped, lastFinishedRun: run() }))).toBe('previous run took 1m');
  });

  test('uses the last run when the server does not report finished runs separately', () => {
    expect(describeRunDurationBrief(status({ lastRun: run() }))).toBe('took 1m');
  });

  test('says a run cut off by a restart ended that way instead of naming the previous run', () => {
    const interrupted = run({ id: 2, status: 'interrupted', finishedAt: null });
    expect(describeRunDurationBrief(status({ lastRun: interrupted, lastFinishedRun: run() }))).toBe('by a server restart');
  });

  test('is null when no run has finished', () => {
    expect(describeRunDurationBrief(status({ lastRun: run({ status: 'running', finishedAt: null }), lastFinishedRun: null })))
      .toBeNull();
  });
});
