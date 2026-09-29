import { RunBlockReason, ScheduleRun, ScheduleTaskStatus } from '../../hooks/useScheduleStatus';

const SECOND_MS = 1000;
const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

// Runs that did their work and recorded a finish time.
const FINISHED_STATUSES = new Set<ScheduleRun['status']>(['success', 'error']);

export type TaskTone = 'running' | 'error' | 'warning' | 'off' | 'ok' | 'unknown';

export interface TaskState {
  tone: TaskTone;
  // A word for states the rest of the row does not already say; null when healthy.
  label: string | null;
}

export interface SummaryPart {
  text: string;
  tone?: 'running' | 'error';
}

// Short enough for one line on a phone. Reasons the row already shows
// (running, turned off, platform managed) are left out; the full hint with
// its link is in the expanded details.
const SHORT_BLOCK_REASONS: Partial<Record<RunBlockReason, string>> = {
  cooldown: 'ran recently',
  'downloads-paused': 'downloads are paused',
  'no-media-server': 'no media server',
  'youtube-throttled': 'YouTube is throttling',
  'downloads-active': 'downloads are running',
  'not-registered': 'not available',
};

// "12m", "3h 25m", "2d 4h".
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.abs(ms) / MINUTE_MS);
  const days = Math.floor(totalMinutes / (MINUTES_PER_HOUR * HOURS_PER_DAY));
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR) % HOURS_PER_DAY;
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

// How long a run took: seconds matter for short tasks ("14s", "2m 14s"),
// and longer runs round to minutes like every other time on the page.
export function formatRunDuration(ms: number): string {
  if (ms < SECOND_MS) return 'under 1s';
  if (ms >= MINUTES_PER_HOUR * MINUTE_MS) return formatDuration(ms);
  const minutes = Math.floor(ms / MINUTE_MS);
  const seconds = Math.floor((ms % MINUTE_MS) / SECOND_MS);
  if (minutes === 0) return `${seconds}s`;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

// Only a run that did its work and recorded a finish has a length.
export function runDurationMs(run: ScheduleRun | null | undefined): number | null {
  if (!run || !FINISHED_STATUSES.has(run.status) || !run.finishedAt) return null;
  const ms = Date.parse(run.finishedAt) - Date.parse(run.startedAt);
  return Number.isFinite(ms) ? Math.max(0, ms) : null;
}

// "in 2m 14s" for a completed run, "after 2m 14s" for a failed one.
export function describeDurationPhrase(run: ScheduleRun | null | undefined): string | null {
  const ms = runDurationMs(run);
  if (ms === null || !run) return null;
  return `${run.status === 'error' ? 'after' : 'in'} ${formatRunDuration(ms)}`;
}

// The newest finished run, falling back to the last run when the server
// does not report finished runs separately.
export function finishedRunOf(status: ScheduleTaskStatus): ScheduleRun | null {
  if (status.lastFinishedRun !== undefined) return status.lastFinishedRun;
  return runDurationMs(status.lastRun) === null ? null : status.lastRun;
}

// For the collapsed row: how long the last finished run took, saying so when
// it is not the run shown as the last run (that one was skipped or is still
// going). A run cut off by a restart has no length, so the row says why
// instead; only the startup pass marks runs interrupted.
export function describeRunDurationBrief(status: ScheduleTaskStatus | undefined): string | null {
  if (!status) return null;
  if (status.lastRun?.status === 'interrupted') return 'by a server restart';
  const finished = finishedRunOf(status);
  const ms = runDurationMs(finished);
  if (ms === null || !finished) return null;
  const isLastRun = status.lastRun?.id === finished.id;
  return `${isLastRun ? 'took' : 'previous run took'} ${formatRunDuration(ms)}`;
}

function timeAgo(iso: string, now: number): string {
  const elapsed = now - Date.parse(iso);
  return !Number.isFinite(elapsed) || elapsed < MINUTE_MS ? 'just now' : `${formatDuration(elapsed)} ago`;
}

function timeUntil(iso: string, now: number): string {
  const remaining = Date.parse(iso) - now;
  return !Number.isFinite(remaining) || remaining < MINUTE_MS ? 'in under a minute' : `in ${formatDuration(remaining)}`;
}

export function isTaskRunning(status: ScheduleTaskStatus | undefined): boolean {
  return Boolean(status && (status.running || status.runNow.reason === 'running'));
}

function isPartial(run: ScheduleRun): boolean {
  return run.outcome === 'partial';
}

// The row's status dot and, for states that need a word, its label.
export function describeTaskState(status: ScheduleTaskStatus | undefined, managed: boolean): TaskState {
  if (!status) return { tone: 'unknown', label: null };
  if (isTaskRunning(status)) return { tone: 'running', label: 'Running' };
  if (managed) return { tone: 'off', label: 'Managed' };
  if (status.error && !status.active) return { tone: 'error', label: 'Not scheduled' };
  if (status.error) return { tone: 'warning', label: 'Not applied' };
  if (!status.active) return { tone: 'off', label: 'Off' };
  const run = status.lastRun;
  if (run?.status === 'error') return { tone: isPartial(run) ? 'warning' : 'error', label: null };
  if (run?.status === 'interrupted') return { tone: 'warning', label: null };
  return { tone: 'ok', label: null };
}

export function describeNextRun(status: ScheduleTaskStatus | undefined, now: number): string {
  if (!status) return '';
  if (!status.active || !status.nextRunAt) return 'No upcoming run';
  return `Next ${timeUntil(status.nextRunAt, now)}`;
}

export function describeLastRunBrief(run: ScheduleRun | null, now: number): { text: string; tone: TaskTone } {
  if (!run) return { text: 'Never run', tone: 'ok' };
  const ago = timeAgo(run.startedAt, now);
  switch (run.status) {
    case 'running':
      return { text: `Started ${ago}`, tone: 'running' };
    case 'error':
      return isPartial(run)
        ? { text: `Partly failed ${ago}`, tone: 'warning' }
        : { text: `Failed ${ago}`, tone: 'error' };
    case 'interrupted':
      return { text: `Interrupted ${ago}`, tone: 'warning' };
    case 'skipped':
      return { text: `Skipped ${ago}`, tone: 'ok' };
    default:
      return { text: `Ran ${ago}`, tone: 'ok' };
  }
}

export function describeRunNowBlockBrief(status: ScheduleTaskStatus | undefined): string | null {
  if (!status || status.runNow.available || !status.runNow.reason) return null;
  const reason = SHORT_BLOCK_REASONS[status.runNow.reason];
  return reason ? `Run now unavailable: ${reason}` : null;
}

// One line over every task: how many there are, how many are running or
// failed last time, and which runs next. Empty until the status has loaded.
export function summarizeTasks(tasks: ScheduleTaskStatus[], now: number): SummaryPart[] {
  if (tasks.length === 0) return [];
  const parts: SummaryPart[] = [{ text: `${tasks.length} tasks` }];
  const running = tasks.filter(isTaskRunning).length;
  if (running > 0) parts.push({ text: `${running} running`, tone: 'running' });
  const failed = tasks.filter((task) => !isTaskRunning(task) && task.lastRun?.status === 'error').length;
  if (failed > 0) parts.push({ text: `${failed} failed last run`, tone: 'error' });
  const next = tasks
    .filter((task) => task.active && task.nextRunAt)
    .sort((a, b) => (a.nextRunAt as string).localeCompare(b.nextRunAt as string))[0];
  parts.push({ text: next ? `next: ${next.label} ${timeUntil(next.nextRunAt as string, now)}` : 'nothing scheduled' });
  return parts;
}
