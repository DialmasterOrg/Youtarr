import cronstrue from 'cronstrue';
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

const MAX_SECOND = 59;
const MAX_MINUTE = 59;
const MAX_HOUR = 23;
const MAX_DAY_OF_MONTH = 31;
const MAX_MONTH = 12;
const MAX_DAY_OF_WEEK = 6;
// The server accepts 7 in the weekday field; node-cron then rewrites it to 0.
const MAX_DAY_OF_WEEK_TOKEN = 7;
const MIN_FIELD_COUNT = 5;
const MAX_FIELD_COUNT = 6;
const NAME_ABBREVIATION_LENGTH = 3;
const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'];
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

interface FieldLimits {
  min: number;
  max: number;
  names?: string[];
  // Applied before parsing, for a field node-cron rewrites first. The raw
  // tokens are checked against rawMax beforehand, as the server does.
  normalize?: (field: string) => string;
  rawMax?: number;
}

interface CronFields {
  fields: string[];
  limits: FieldLimits[];
}

interface FieldPart {
  first: number;
  last: number;
  wildcard: boolean;
}

interface ParsedField {
  parts: FieldPart[];
  step: number | null;
}

interface ParsedExpression {
  fields: ParsedField[];
  limits: FieldLimits[];
}

// Second, minute, hour, day of month, month, day of week. A five-field
// expression omits the second.
const FIELD_LIMITS: FieldLimits[] = [
  { min: 0, max: MAX_SECOND },
  { min: 0, max: MAX_MINUTE },
  { min: 0, max: MAX_HOUR },
  { min: 1, max: MAX_DAY_OF_MONTH },
  { min: 1, max: MAX_MONTH, names: MONTH_NAMES },
  // node-cron rewrites the first 7 in this field to 0 before it reads ranges,
  // so 7 is Sunday but 5-7 is Sunday through Friday and 1-7 is Sunday and Monday.
  {
    min: 0,
    max: MAX_DAY_OF_WEEK,
    rawMax: MAX_DAY_OF_WEEK_TOKEN,
    names: DAY_NAMES,
    normalize: (field) => field.replace('7', '0'),
  },
];

// A number within the field's bounds, or a full or three-letter month or
// weekday name, as node-cron reads them. Null for anything else.
function parseBound(token: string, { min, max, names = [] }: FieldLimits): number | null {
  if (/^\d+$/.test(token)) {
    const value = Number(token);
    return Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
  }
  const name = token.toLowerCase();
  const index = names.findIndex((full) => name === full || name === full.slice(0, NAME_ABBREVIATION_LENGTH));
  return index === -1 ? null : index + min;
}

// Mirrors isSafeField in server/modules/scheduleConfig.js. Returns null for a
// field the server would reject, since the field error is the right message there.
function parseField(field: string, limits: FieldLimits): ParsedField | null {
  if (limits.normalize) {
    // Otherwise 70 would read as 00 and pass, while the server rejects it.
    const rawLimits = { min: limits.min, max: limits.rawMax ?? limits.max, names: limits.names };
    if (parseField(field, rawLimits) === null) return null;
  }
  const [list, step, extra] = (limits.normalize ? limits.normalize(field) : field).split('/');
  if (extra !== undefined) return null;
  if (step !== undefined && (!/^\d+$/.test(step) || !Number.isSafeInteger(Number(step)) || Number(step) <= 0)) {
    return null;
  }
  const parts: FieldPart[] = [];
  for (const part of list.split(',')) {
    if (part === '*') {
      parts.push({ first: limits.min, last: limits.max, wildcard: true });
      continue;
    }
    const bounds = part.split('-').map((token) => parseBound(token, limits));
    if (bounds.length > 2) return null;
    if (!bounds.every((bound): bound is number => bound !== null)) return null;
    // node-cron reads a reversed range low to high.
    parts.push({ first: Math.min(...bounds), last: Math.max(...bounds), wildcard: false });
  }
  return { parts, step: step === undefined ? null : Number(step) };
}

// node-cron's reading of a step, mirroring expandField in
// server/modules/scheduleConfig.js: the values in the range divisible by it.
function expandPart({ first, last }: FieldPart, step: number | null): number[] {
  const values: number[] = [];
  for (let value = first; value <= last; value += 1) {
    if (step === null || value % step === 0) values.push(value);
  }
  return values;
}

function expandParsedField({ parts, step }: ParsedField): number[] {
  const values = new Set<number>();
  for (const part of parts) {
    for (const value of expandPart(part, step)) values.add(value);
  }
  return Array.from(values).sort((a, b) => a - b);
}

function expandField(field: string, limits: FieldLimits): number[] | null {
  const parsed = parseField(field, limits);
  return parsed === null ? null : expandParsedField(parsed);
}

function splitFields(expression: string): CronFields | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length < MIN_FIELD_COUNT || fields.length > MAX_FIELD_COUNT) return null;
  return { fields, limits: FIELD_LIMITS.slice(FIELD_LIMITS.length - fields.length) };
}

// The parsed fields of an expression the server would accept, or null. A step
// that leaves no value (10/11, 1-9/10) fails node-cron's parser, so it fails here too.
function parseSupportedExpression(expression: string): ParsedExpression | null {
  const split = splitFields(expression);
  if (split === null) return null;
  const fields: ParsedField[] = [];
  for (let index = 0; index < split.fields.length; index += 1) {
    const parsed = parseField(split.fields[index], split.limits[index]);
    if (parsed === null || expandParsedField(parsed).length === 0) return null;
    fields.push(parsed);
  }
  return { fields, limits: split.limits };
}

export function isSupportedCronSyntax(expression: string): boolean {
  return typeof expression === 'string' && parseSupportedExpression(expression) !== null;
}

// True when the minute field matches more than one minute, so the schedule
// fires more than once during each hour it covers. Sets the per-task
// frequentRunWarning; the server enforces the hard 15-minute floor.
export function runsMoreThanHourly(expression: string): boolean {
  if (typeof expression !== 'string') return false;
  const split = splitFields(expression);
  if (split === null) return false;
  const minuteIndex = split.fields.length === MAX_FIELD_COUNT ? 1 : 0;
  const minutes = expandField(split.fields[minuteIndex], split.limits[minuteIndex]);
  return minutes !== null && minutes.length > 1;
}

// Standard cron's reading of a step, which is what cronstrue describes: from
// the range start, every step; a lone value with a step runs to the field's end.
function expandPartAsStandardCron({ first, last }: FieldPart, step: number, max: number): number[] {
  const end = first === last ? max : last;
  const values: number[] = [];
  for (let value = first; value <= end; value += step) values.push(value);
  return values;
}

function sameValues(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function toPartText({ first, last, wildcard }: FieldPart): string {
  if (wildcard) return '*';
  return first === last ? String(first) : `${first}-${last}`;
}

// The field as cronstrue should read it, carrying node-cron's meaning:
// canonical numbers, ranges low to high, and a step only where standard cron
// expands it to the same values; otherwise the values themselves.
function toDescribableField(parsed: ParsedField, limits: FieldLimits): string {
  const { parts, step } = parsed;
  if (step === null) return parts.map(toPartText).join(',');
  const values = expandParsedField(parsed);
  const keepStep = parts.length === 1
    && sameValues(values, expandPartAsStandardCron(parts[0], step, limits.max));
  return keepStep ? `${toPartText(parts[0])}/${step}` : values.join(',');
}

// Matches node-cron: a 24-hour clock, and a day-of-month plus weekday pair
// must both match rather than either.
const DESCRIPTION_OPTIONS = { use24HourTimeFormat: true, logicalAndDayFields: true };

export function describeSchedule(expression: string): string {
  if (typeof expression !== 'string') return 'Invalid schedule';
  const time = getDailyTime(expression);
  if (time) return `Daily at ${time}`;
  const preset = Object.entries(FREQUENCY_MAPPING).find(([, value]) => value === expression);
  if (preset) return preset[0];
  if (!expression.trim()) return 'Schedule required';
  const parsed = parseSupportedExpression(expression);
  if (parsed === null) return `Custom: ${expression}`;
  const describable = parsed.fields
    .map((field, index) => toDescribableField(field, parsed.limits[index]))
    .join(' ');
  try {
    return cronstrue.toString(describable, DESCRIPTION_OPTIONS);
  } catch {
    // cronstrue may still reject syntax node-cron runs; echo rather than break the page.
    return `Custom: ${expression}`;
  }
}
