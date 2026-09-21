import { CONFIG_FIELDS } from '../../config/configSchema';
import { FREQUENCY_MAPPING } from './constants';

// Mirrors MIN_SCHEDULE_INTERVAL_MINUTES in server/modules/scheduleConfig.js, which enforces it.
export const MIN_SCHEDULE_INTERVAL_MINUTES = 15;

export const SCHEDULE_GROUPS = [
  { key: 'sync', title: 'Downloads and sync' },
  { key: 'maintenance', title: 'Maintenance' },
] as const;

// Ordered by how often people touch them: the feature schedules first, then the
// nightly maintenance, with the rarely changed ones last.
export const SCHEDULE_FIELDS = [
  {
    key: 'channelDownloadFrequency',
    group: 'sync',
    label: 'Automatic downloads',
    description: 'Check enabled channels and playlists for videos to download.',
    settingsPath: 'core',
    settingsLabel: 'Core settings',
    enabledKey: 'channelAutoDownload',
    disabledText: 'Automatic downloads are off, so this schedule is idle until you turn them on.',
    frequentRunWarning: null,
  },
  {
    key: 'watchStatusSyncFrequency',
    group: 'sync',
    label: 'Watch status sync',
    description: 'Read watch status from your connected media servers.',
    settingsPath: 'watch-status',
    settingsLabel: 'Watch status settings',
    enabledKey: 'watchStatusSyncEnabled',
    disabledText: 'Watch status sync is off, so this schedule is idle until you turn it on.',
    frequentRunWarning: 'Every sync lists the full library of each connected media server. Running it more than once an hour adds load to those servers for little benefit; use Sync Now when you need an immediate update.',
  },
  {
    key: 'autoRemovalFrequency',
    group: 'maintenance',
    label: 'Automatic video cleanup',
    description: 'Apply your video removal rules and clean up empty channel folders.',
    settingsPath: 'autoremove',
    settingsLabel: 'Auto Removal settings',
    enabledKey: 'autoRemovalEnabled',
    disabledText: 'Video removal is off, so each run removes empty channel folders only.',
    frequentRunWarning: 'Every run evaluates your removal rules against the whole library and walks the download folders for empty directories. Once a day is usually enough.',
  },
  {
    key: 'videoRescanFrequency',
    group: 'maintenance',
    label: 'Rescan files on disk',
    description: 'Reconcile library records with files on disk and fill in missing metadata. This also runs at startup.',
    settingsPath: 'maintenance',
    settingsLabel: 'Maintenance',
    enabledKey: null,
    disabledText: null,
    frequentRunWarning: 'Every rescan walks every file in your download folders and probes videos with ffprobe. Running it more than once an hour keeps the disk busy for little benefit; use the manual rescan after you change files.',
  },
  {
    key: 'ytdlpUpdateFrequency',
    group: 'maintenance',
    label: 'Automatic yt-dlp updates',
    description: 'Check for and install updates from your selected yt-dlp release channel.',
    settingsPath: 'downloading',
    settingsLabel: 'YT-DLP settings',
    enabledKey: 'autoUpdateYtdlp',
    disabledText: 'Automatic yt-dlp updates are off, so this schedule is idle until you turn them on.',
    frequentRunWarning: 'Every run contacts GitHub to check for a release. Running it more than once an hour can hit GitHub rate limits, and yt-dlp releases at most a few times a week.',
  },
  {
    key: 'archiveBackfillFrequency',
    group: 'maintenance',
    label: 'Repair library records',
    description: 'Recover missing library records from the download archive. This also runs at startup.',
    settingsPath: 'maintenance',
    settingsLabel: 'Maintenance',
    enabledKey: null,
    disabledText: null,
    frequentRunWarning: 'Every run reads the whole download archive and checks each entry against the database. Once a day is usually enough.',
  },
  {
    key: 'sessionCleanupFrequency',
    group: 'maintenance',
    label: 'Session cleanup',
    description: 'Remove expired and old inactive login sessions.',
    settingsPath: 'security',
    settingsLabel: 'Security settings',
    enabledKey: null,
    disabledText: null,
    frequentRunWarning: 'Sessions expire after seven days, so running cleanup more than once an hour does nothing extra.',
  },
] as const;

export type ScheduleKey = typeof SCHEDULE_FIELDS[number]['key'];
export type ScheduleFieldErrors = Partial<Record<ScheduleKey, string>>;

export const getDefaultSchedule = (key: ScheduleKey): string => CONFIG_FIELDS[key].default;

export function getDailyTime(expression: string): string | null {
  if (typeof expression !== 'string') return null;
  const match = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(expression.trim());
  if (!match || Number(match[1]) > 59 || Number(match[2]) > 23) return null;
  return `${match[2].padStart(2, '0')}:${match[1].padStart(2, '0')}`;
}

export function isRecognizedSchedule(expression: string): boolean {
  if (typeof expression !== 'string') return false;
  const trimmed = expression.trim();
  return getDailyTime(trimmed) !== null || Object.values(FREQUENCY_MAPPING).includes(trimmed);
}

const MAX_MINUTE = 59;

// Mirrors expandField in server/modules/scheduleConfig.js. Returns null for a
// field the server would reject, since the field error is the right message there.
function expandMinutes(field: string): Set<number> | null {
  const [list, step, extra] = field.split('/');
  if (extra !== undefined) return null;
  if (step !== undefined && (!/^\d+$/.test(step) || Number(step) <= 0)) return null;
  const divider = step === undefined ? 1 : Number(step);
  const minutes = new Set<number>();
  for (const part of list.split(',')) {
    let first = 0;
    let last = MAX_MINUTE;
    if (part !== '*') {
      const bounds = part.split('-');
      if (bounds.length > 2 || !bounds.every((token) => /^\d+$/.test(token))) return null;
      const values = bounds.map(Number);
      first = Math.min(...values);
      last = Math.max(...values);
    }
    for (let minute = 0; minute <= MAX_MINUTE; minute += 1) {
      if (minute >= first && minute <= last && minute % divider === 0) minutes.add(minute);
    }
  }
  return minutes;
}

// True when the minute field matches more than one minute, so the schedule
// fires more than once during each hour it covers. Sets the per-task
// frequentRunWarning; the server enforces the hard 15-minute floor.
export function runsMoreThanHourly(expression: string): boolean {
  if (typeof expression !== 'string') return false;
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5 && fields.length !== 6) return false;
  const minutes = expandMinutes(fields[fields.length === 6 ? 1 : 0]);
  return minutes !== null && minutes.size > 1;
}

export function describeSchedule(expression: string): string {
  if (typeof expression !== 'string') return 'Invalid schedule';
  const time = getDailyTime(expression);
  if (time) return `Daily at ${time}`;
  const preset = Object.entries(FREQUENCY_MAPPING).find(([, value]) => value === expression);
  return preset?.[0] || (expression.trim() ? `Custom: ${expression}` : 'Schedule required');
}
