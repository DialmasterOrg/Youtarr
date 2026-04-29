const logger = require('../../logger');
const { QUOTA_RESET_TIMEZONE } = require('./constants');

/**
 * Compute the next midnight in the given IANA timezone as a Date.
 * Uses Intl.DateTimeFormat with parts so we do not pull in a tz library.
 */
// Force hourCycle h23 so hour parts are always 0-23. en-US otherwise resolves
// to h24 (1-24, midnight reported as 24), which makes any 00:xx wall-clock
// time come back as hour=24 and breaks the offset arithmetic.
// NOTE: do NOT set hour12 alongside hourCycle - hour12 takes precedence and
// silently undoes the cycle override (Node resolves to h24 again).
const TZ_FORMATTER_OPTIONS = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
};

function readWallParts(formatter, instant) {
  const parts = formatter.formatToParts(instant);
  const lookup = {};
  for (const p of parts) lookup[p.type] = p.value;
  return {
    year: parseInt(lookup.year, 10),
    month: parseInt(lookup.month, 10) - 1,
    day: parseInt(lookup.day, 10),
    hour: parseInt(lookup.hour, 10),
    minute: parseInt(lookup.minute, 10),
    second: parseInt(lookup.second, 10),
  };
}

function nextMidnightInTimezone(timezone, now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, ...TZ_FORMATTER_OPTIONS });

  // Read today's date in the target tz, then derive tomorrow's date via
  // Date.UTC arithmetic so month/year rollover is handled.
  const today = readWallParts(fmt, now);
  const tomorrowSeed = new Date(Date.UTC(today.year, today.month, today.day + 1));
  const targetYear = tomorrowSeed.getUTCFullYear();
  const targetMonth = tomorrowSeed.getUTCMonth();
  const targetDay = tomorrowSeed.getUTCDate();
  const targetWallMs = Date.UTC(targetYear, targetMonth, targetDay, 0, 0, 0);

  // Find the UTC instant whose tz wall-clock equals (targetDay, 00:00:00).
  // Iterate to converge across DST transitions: the tz offset at our initial
  // guess can differ from the offset at the true answer (e.g. on fall-back
  // day the offset shifts from -7 to -8 between "now" and tomorrow midnight),
  // so a single offset application from "now" lands an hour early. Two
  // passes are enough in practice; we cap at three for safety.
  let guess = targetWallMs;
  for (let i = 0; i < 3; i++) {
    const wall = readWallParts(fmt, new Date(guess));
    const wallMs = Date.UTC(wall.year, wall.month, wall.day, wall.hour, wall.minute, wall.second);
    const delta = targetWallMs - wallMs;
    if (delta === 0) break;
    guess += delta;
  }

  return new Date(guess);
}

class QuotaTracker {
  constructor() {
    this.cooldownUntil = null;
    this.exhaustedApiKey = null;
  }

  markExhausted(apiKey = null) {
    this.cooldownUntil = nextMidnightInTimezone(QUOTA_RESET_TIMEZONE);
    this.exhaustedApiKey = apiKey;
    logger.warn(
      { cooldownUntil: this.cooldownUntil.toISOString() },
      'YouTube API quota exhausted - entering cooldown until next Pacific-midnight reset'
    );
  }

  isInCooldown(apiKey = null) {
    if (!this.cooldownUntil) return false;
    if (Date.now() >= this.cooldownUntil.getTime()) {
      this.cooldownUntil = null;
      this.exhaustedApiKey = null;
      return false;
    }
    if (this.exhaustedApiKey && apiKey && this.exhaustedApiKey !== apiKey) {
      return false;
    }
    return true;
  }

  getCooldownUntil() {
    return this.cooldownUntil;
  }

  reset() {
    this.cooldownUntil = null;
    this.exhaustedApiKey = null;
  }
}

module.exports = new QuotaTracker();
