const logger = require('../../logger');
const { QUOTA_RESET_TIMEZONE } = require('./constants');

/**
 * Compute the next midnight in the given IANA timezone as a Date.
 * Uses Intl.DateTimeFormat with parts so we do not pull in a tz library.
 */
function nextMidnightInTimezone(timezone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const lookup = {};
  for (const p of parts) lookup[p.type] = p.value;

  const tzNow = new Date(
    `${lookup.year}-${lookup.month}-${lookup.day}T${lookup.hour === '24' ? '00' : lookup.hour}:${lookup.minute}:${lookup.second}`
  );

  const offsetMs = tzNow.getTime() - now.getTime();
  // Start of "tomorrow" in tz, in tz-wall-clock: next day at 00:00:00
  const tzTomorrow = new Date(tzNow);
  tzTomorrow.setDate(tzTomorrow.getDate() + 1);
  tzTomorrow.setHours(0, 0, 0, 0);

  return new Date(tzTomorrow.getTime() - offsetMs);
}

class QuotaTracker {
  constructor() {
    this.cooldownUntil = null;
  }

  markExhausted() {
    this.cooldownUntil = nextMidnightInTimezone(QUOTA_RESET_TIMEZONE);
    logger.warn(
      { cooldownUntil: this.cooldownUntil.toISOString() },
      'YouTube API quota exhausted - entering cooldown until next Pacific-midnight reset'
    );
  }

  isInCooldown() {
    if (!this.cooldownUntil) return false;
    if (Date.now() >= this.cooldownUntil.getTime()) {
      this.cooldownUntil = null;
      return false;
    }
    return true;
  }

  getCooldownUntil() {
    return this.cooldownUntil;
  }

  reset() {
    this.cooldownUntil = null;
  }
}

module.exports = new QuotaTracker();
