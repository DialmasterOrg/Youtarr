const cron = require('node-cron');
// node-cron's own matcher, so next-run predictions use exactly its semantics.
const TimeMatcher = require('node-cron/src/time-matcher');

const MIN_SCHEDULE_INTERVAL_MINUTES = 15;
const MAX_LOOKAHEAD_DAYS = 366;
const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = 60 * 1000;
const HALF_DAY_MS = 12 * 60 * MS_PER_MINUTE;
const MAX_SECOND = 59;
const MAX_MINUTE = 59;
const MAX_HOUR = 23;
const FIELD_LIMITS = [
  { min: 0, max: MAX_SECOND },
  { min: 0, max: MAX_MINUTE },
  { min: 0, max: MAX_HOUR },
  { min: 1, max: 31 },
  { min: 1, max: 12, names: 'january february march april may june july august september october november december'.split(' ') },
  { min: 0, max: 7, names: 'sunday monday tuesday wednesday thursday friday saturday'.split(' ') },
];

const INVALID_SCHEDULE_MESSAGE = 'enter a valid cron expression.';
const TOO_FREQUENT_MESSAGE =
  `must not run more often than every ${MIN_SCHEDULE_INTERVAL_MINUTES} minutes.`;

const SCHEDULES = {
  channelDownloadFrequency: { label: 'Automatic downloads', default: '0 * * * *' },
  watchStatusSyncFrequency: { label: 'Watch status sync', default: '0 */4 * * *' },
  autoRemovalFrequency: { label: 'Automatic video cleanup', default: '0 2 * * *' },
  archiveBackfillFrequency: { label: 'Repair library records', default: '20 2 * * *' },
  sessionCleanupFrequency: { label: 'Session cleanup', default: '0 3 * * *' },
  videoRescanFrequency: { label: 'Rescan files on disk', default: '30 3 * * *' },
  ytdlpUpdateFrequency: { label: 'Automatic yt-dlp updates', default: '0 4 * * *' },
  channelVideoCountsFrequency: { label: 'Refresh channel video counts', default: '45 4 * * *' },
};

function isValidBound(token, { min, max, names = [] }) {
  if (/^\d+$/.test(token)) {
    const value = Number(token);
    return Number.isSafeInteger(value) && value >= min && value <= max;
  }
  const name = token.toLowerCase();
  return names.some((fullName) => name === fullName || name === fullName.slice(0, 3));
}

// Check raw tokens before node-cron: it expands ranges before validating their
// bounds and accepts numeric prefixes via parseInt (for example, "1e309").
function isSafeField(field, limits) {
  const [list, step, extra] = field.split('/');
  if (extra !== undefined) return false;
  if (step !== undefined && (!/^\d+$/.test(step)
    || !Number.isSafeInteger(Number(step)) || Number(step) <= 0)) return false;
  return list.split(',').every((part) => {
    if (part === '*') return true;
    const bounds = part.split('-');
    return bounds.length <= 2 && bounds.every((token) => isValidBound(token, limits));
  });
}

// Expands a numeric field that node-cron has already accepted, mirroring its
// own conversion: a reversed range (50-10) reads as 10-50, and a step keeps the
// values divisible by it rather than counting from the range start.
function expandField(field, max) {
  const [list, step] = field.split('/');
  const divider = step === undefined ? 1 : Number(step);
  const values = new Set();
  for (const part of list.split(',')) {
    let first = 0;
    let last = max;
    if (part !== '*') {
      const bounds = part.split('-').map(Number);
      first = Math.min(...bounds);
      last = Math.max(...bounds);
    }
    // Iterate the fixed field domain, never an input-controlled range.
    for (let value = 0; value <= max; value += 1) {
      if (value >= first && value <= last && value % divider === 0) values.add(value);
    }
  }
  return [...values].sort((a, b) => a - b);
}

function parseTimeFields(expression) {
  const fields = expression.split(/\s+/);
  const hasSeconds = fields.length === 6;
  const seconds = hasSeconds ? expandField(fields[0], MAX_SECOND) : [0];
  return {
    seconds,
    second: seconds[0],
    minutes: expandField(fields[hasSeconds ? 1 : 0], MAX_MINUTE),
    hours: expandField(fields[hasSeconds ? 2 : 1], MAX_HOUR),
  };
}

// Whether some day the expression fires on is immediately followed by another
// firing day, making its last run and the next day's first run adjacent.
function hasConsecutiveFiringDays(expression, { second, minutes }, from = new Date()) {
  const matcher = new TimeMatcher(expression);
  const lastMinute = minutes[minutes.length - 1];
  const firstMinute = minutes[0];
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  for (let offset = 0; offset < MAX_LOOKAHEAD_DAYS; offset += 1) {
    const late = new Date(day);
    late.setDate(day.getDate() + offset);
    late.setHours(MAX_HOUR, lastMinute, second, 0);
    const early = new Date(day);
    early.setDate(day.getDate() + offset + 1);
    early.setHours(0, firstMinute, second, 0);
    if (matcher.match(late) && matcher.match(early)) return true;
  }
  return false;
}

function runsTooOften(expression) {
  const fields = parseTimeFields(expression);
  const { seconds, second, minutes, hours } = fields;
  if (seconds.length !== 1) return true;

  for (let i = 1; i < minutes.length; i += 1) {
    if (minutes[i] - minutes[i - 1] < MIN_SCHEDULE_INTERVAL_MINUTES) return true;
  }

  // The last minute of one hour and the first of the next only meet when both
  // hours fire. Within a day that never depends on the calendar; across
  // midnight it depends on which days actually fire.
  const wrapGap = MINUTES_PER_HOUR - minutes[minutes.length - 1] + minutes[0];
  if (wrapGap >= MIN_SCHEDULE_INTERVAL_MINUTES) return false;
  if (hours.some((hour) => hour < MAX_HOUR && hours.includes(hour + 1))) return true;
  return hours.includes(MAX_HOUR) && hours.includes(0)
    && hasConsecutiveFiringDays(expression, { second, minutes });
}

function getSyntaxError(value) {
  if (typeof value !== 'string' || !value.trim()) return INVALID_SCHEDULE_MESSAGE;
  const expression = value.trim();
  const fields = expression.split(/\s+/);
  // node-cron 3 otherwise ignores extra fields after the sixth.
  if (fields.length !== 5 && fields.length !== 6) return INVALID_SCHEDULE_MESSAGE;
  const offset = fields.length === 5 ? 1 : 0;
  if (!fields.every((field, index) => isSafeField(field, FIELD_LIMITS[index + offset]))
    || !cron.validate(expression)) {
    return INVALID_SCHEDULE_MESSAGE;
  }
  return null;
}

function getScheduleError(value) {
  const syntaxError = getSyntaxError(value);
  if (syntaxError) return syntaxError;
  return runsTooOften(value.trim()) ? TOO_FREQUENT_MESSAGE : null;
}

function isValidSchedule(value) {
  return getScheduleError(value) === null;
}

function violatesMinimumInterval(value) {
  return getSyntaxError(value) === null && runsTooOften(value.trim());
}

// A minute list that is a clean step from zero reads better as */n.
function toMinuteField(minutes) {
  const step = minutes[1];
  const isCleanStep = minutes.length > 1
    && minutes[0] === 0
    && MINUTES_PER_HOUR % step === 0
    && minutes.length === MINUTES_PER_HOUR / step
    && minutes.every((minute, index) => minute === index * step);
  return isCleanStep ? `*/${step}` : minutes.join(',');
}

// Rewrites an expression that breaks the floor by dropping runs, never adding
// them. The hour and calendar fields are left alone, so `0,5 2 * * 0` keeps its
// Sunday 02:00 window instead of turning into every fifteen minutes all week.
function normalizeToMinimumInterval(value) {
  if (!violatesMinimumInterval(value)) return value;
  const fields = value.trim().split(/\s+/);
  const hasSeconds = fields.length === 6;
  if (hasSeconds) fields[0] = String(expandField(fields[0], MAX_SECOND)[0]);
  const minuteIndex = hasSeconds ? 1 : 0;

  const kept = [];
  for (const minute of expandField(fields[minuteIndex], MAX_MINUTE)) {
    if (kept.length === 0 || minute - kept[kept.length - 1] >= MIN_SCHEDULE_INTERVAL_MINUTES) {
      kept.push(minute);
    }
  }
  const build = () => {
    fields[minuteIndex] = toMinuteField(kept);
    return fields.join(' ');
  };
  let candidate = build();
  // The wrap into the next hour or day can still be too close: drop from the end.
  while (kept.length > 1 && runsTooOften(candidate)) {
    kept.pop();
    candidate = build();
  }
  return candidate;
}

// When clocks fall back the same wall-clock time occurs twice and setHours
// only yields the first. The repeat sits one offset change later: an hour in
// most zones, thirty minutes in some, so the shift comes from the offsets.
function repeatedOccurrence(candidate) {
  const later = new Date(candidate.getTime() + HALF_DAY_MS);
  const shiftMinutes = later.getTimezoneOffset() - candidate.getTimezoneOffset();
  if (shiftMinutes <= 0) return null;
  const repeated = new Date(candidate.getTime() + shiftMinutes * MS_PER_MINUTE);
  const sameWallClock = repeated.getHours() === candidate.getHours()
    && repeated.getMinutes() === candidate.getMinutes();
  return sameWallClock ? repeated : null;
}

// Every instant on one day the expression could fire at, in time order.
function candidatesForDay(day, offset, { second, minutes, hours }) {
  const candidates = [];
  for (const hour of hours) {
    for (const minute of minutes) {
      const candidate = new Date(day);
      candidate.setDate(day.getDate() + offset);
      candidate.setHours(hour, minute, second, 0);
      candidates.push(candidate);
      const repeated = repeatedOccurrence(candidate);
      if (repeated) candidates.push(repeated);
    }
  }
  return candidates.sort((a, b) => a - b);
}

// Next local-time occurrence strictly after `from`, or null when none falls
// within a year. Only the minutes and hours the expression can fire on are
// tested; the matcher decides the day, month, and weekday.
function getNextRun(expression, from = new Date()) {
  if (getScheduleError(expression)) return null;
  const trimmed = expression.trim();
  const fields = parseTimeFields(trimmed);
  const matcher = new TimeMatcher(trimmed);
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);

  for (let offset = 0; offset < MAX_LOOKAHEAD_DAYS; offset += 1) {
    for (const candidate of candidatesForDay(day, offset, fields)) {
      if (candidate > from && matcher.match(candidate)) return candidate;
    }
  }
  return null;
}

function getSchedule(config, key) {
  // Explicitly invalid values must not silently fall back to another time.
  return config[key] === undefined ? SCHEDULES[key].default : config[key];
}

module.exports = {
  SCHEDULES,
  MIN_SCHEDULE_INTERVAL_MINUTES,
  getScheduleError,
  getNextRun,
  isValidSchedule,
  violatesMinimumInterval,
  normalizeToMinimumInterval,
  getSchedule,
};
