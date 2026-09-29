const configModule = require('../configModule');

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_BACKOFF_MS = 6 * 60 * 60 * 1000;
const MAX_BACKOFF_MS = DAY_MS;
// A pause that ended this long ago is forgotten: the next throttle starts
// from 6 hours again instead of doubling. Longer than the ~24h between
// consecutive throttled daily runs, so real repeats still double.
const BACKOFF_DECAY_MS = 3 * DAY_MS;
// Bulk runs without cookies that must hit a bot check, in a row and without
// counting anything, before bulk runs switch to sending the cookies (an IP
// that YouTube bot-checks whenever cookies are missing, like a VPS).
const COOKIELESS_BOT_CHECKS_BEFORE_COOKIES = 2;
// How long bulk runs keep sending cookies before trying without them again.
const COOKIE_MODE_RETRY_MS = 30 * DAY_MS;
// The outcome a bulk run records when YouTube pushed back.
const THROTTLED_OUTCOME = 'throttled';
// Run statuses of refreshes that actually ran (not skipped or interrupted).
const EXECUTED_STATUSES = ['success', 'error'];

const SCOPE = {
  // Bulk refreshes only: a bot check on a lookup without cookies says
  // nothing about lookups that send the user's cookies.
  BULK: 'bulk',
  // Every refresh, on-demand ones included.
  ALL: 'all',
};

function parseTime(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

/**
 * YouTube throttling state for tab count lookups, kept as three independent
 * parts:
 * - the pause: after a 429, "try again later", or a bot check, refreshes
 *   pause for 6 hours, doubling up to 24 hours while throttles keep coming,
 *   and forgotten 3 days after it ends;
 * - the cookie mode: bulk runs go without cookies until two of them in a row
 *   hit a bot check (cookies configured, nothing counted), then send the
 *   cookies, still paced, for 30 days before trying without them again;
 * - the count of those consecutive bot checks.
 *
 * The run history is the persistence layer for all three: every executed
 * bulk run records currentDetails() in its run details, and the latest
 * executed run is read back after a restart, whatever its outcome.
 */
class TabCountThrottle {
  constructor() {
    this.pause = null;
    this.cookieModeSince = null;
    this.cookielessBotChecks = 0;
    // Bumped by every start(), so a bulk run can tell whether a throttle
    // happened while it was running.
    this.revision = 0;
    this.runHistory = null;
    this.taskKey = null;
    this.loading = null;
  }

  /**
   * @param {{ getLatestRun: Function }} runHistory - scheduledTaskRuns
   * @param {string} taskKey - the refresh task's run history key
   */
  useRunHistory(runHistory, taskKey) {
    this.runHistory = runHistory;
    this.taskKey = taskKey;
    this.loading = null;
  }

  /**
   * How long refreshes of this kind stay paused.
   * @param {'bulk'|'on-demand'} kind
   * @returns {Promise<number>} milliseconds, 0 when not paused
   */
  async remainingMs(kind, now = Date.now()) {
    await this._load();
    const pause = this._activePause(now);
    if (!pause) return 0;
    if (kind !== 'bulk' && pause.scope !== SCOPE.ALL) return 0;
    return Math.max(0, pause.until - now);
  }

  /**
   * Whether the next bulk run sends cookies. Ends a 30-day-old switch, so
   * that run tries without cookies again.
   * @returns {Promise<boolean>}
   */
  async bulkUsesCookies(now = Date.now()) {
    await this._load();
    if (this.cookieModeSince !== null && now - this.cookieModeSince >= COOKIE_MODE_RETRY_MS) {
      this.cookieModeSince = null;
      this.cookielessBotChecks = 0;
    }
    return this.cookieModeSince !== null && Boolean(configModule.getCookiesPath());
  }

  /**
   * Update the cookie mode after a bulk run that looked channels up. Call
   * after bulkUsesCookies() for the same run.
   * @param {{ sentCookies: boolean, counted: boolean, botCheck: boolean }} run -
   *   counted: any tab was counted, even on a channel left partly counted
   * @returns {{ switchedToCookies: boolean }}
   */
  recordBulkRun({ sentCookies, counted, botCheck }, now = Date.now()) {
    const cookielessBotCheck = botCheck && !counted && !sentCookies && Boolean(configModule.getCookiesPath());
    // Any other run that looked something up breaks the streak.
    if (!cookielessBotCheck) {
      this.cookielessBotChecks = 0;
      return { switchedToCookies: false };
    }
    this.cookielessBotChecks += 1;
    if (this.cookielessBotChecks < COOKIELESS_BOT_CHECKS_BEFORE_COOKIES) return { switchedToCookies: false };
    this.cookieModeSince = now;
    this.cookielessBotChecks = 0;
    return { switchedToCookies: true };
  }

  /**
   * Start a pause after YouTube pushed back.
   * @param {{ reason: 'bot-check'|'rate-limit', sentCookies: boolean }} throttle
   * @returns {Promise<{ backoffReason: string, backoffScope: string,
   *   backoffMs: number, backoffUntil: string }>} the run record details
   */
  async start({ reason, sentCookies }, now = Date.now()) {
    await this._load();
    const previous = this._activePause(now);
    const cookielessBotCheck = reason === 'bot-check' && !sentCookies && Boolean(configModule.getCookiesPath());
    const stillPausedForAll = previous && previous.until > now && previous.scope === SCOPE.ALL;
    const scope = cookielessBotCheck && !stillPausedForAll ? SCOPE.BULK : SCOPE.ALL;
    const durationMs = previous ? Math.min(previous.durationMs * 2, MAX_BACKOFF_MS) : BASE_BACKOFF_MS;
    this.pause = { until: now + durationMs, scope, durationMs };
    this.revision += 1;
    return {
      backoffReason: reason,
      backoffScope: scope,
      backoffMs: durationMs,
      backoffUntil: new Date(this.pause.until).toISOString(),
    };
  }

  getRevision() {
    return this.revision;
  }

  /**
   * End the pause doubling after a bulk run that looked channels up without
   * being throttled, unless a throttle (from an overlapping on-demand lookup)
   * started a newer pause while it ran. The cookie mode is untouched.
   * @param {number} revision - getRevision() from when the run started
   */
  clearIfUnchanged(revision) {
    if (this.revision === revision) this.pause = null;
  }

  /**
   * The state to record in a run's details: the pause (an ended one too,
   * until it decays or is cleared), the cookie mode, and the bot check count.
   * @returns {Promise<Object>}
   */
  async currentDetails(now = Date.now()) {
    await this._load();
    const details = {};
    const pause = this._activePause(now);
    if (pause) {
      details.backoffScope = pause.scope;
      details.backoffMs = pause.durationMs;
      details.backoffUntil = new Date(pause.until).toISOString();
    }
    if (this.cookieModeSince !== null) details.bulkCookiesSince = new Date(this.cookieModeSince).toISOString();
    if (this.cookielessBotChecks > 0) details.cookielessBotChecks = this.cookielessBotChecks;
    return details;
  }

  _activePause(now) {
    if (this.pause && now - this.pause.until > BACKOFF_DECAY_MS) this.pause = null;
    return this.pause;
  }

  async _load() {
    if (!this.loading) this.loading = this._readLatestRun();
    return this.loading;
  }

  async _readLatestRun() {
    if (!this.runHistory) return;
    const run = await this.runHistory.getLatestRun(this.taskKey, { statuses: EXECUTED_STATUSES });
    // State recorded in memory while the history was being read is newer.
    if (!run || this.pause || this.cookieModeSince !== null || this.cookielessBotChecks > 0) return;
    const details = run.details || {};

    const until = parseTime(details.backoffUntil);
    if (until !== null && Object.values(SCOPE).includes(details.backoffScope)) {
      const durationMs = Number.isFinite(details.backoffMs) && details.backoffMs > 0 ? details.backoffMs : BASE_BACKOFF_MS;
      // A restored pause decays like any other: every read goes through
      // _activePause, so one that ended over 3 days ago is dropped on use.
      this.pause = { until, scope: details.backoffScope, durationMs };
    }
    this.cookieModeSince = parseTime(details.bulkCookiesSince);
    if (Number.isInteger(details.cookielessBotChecks) && details.cookielessBotChecks > 0) {
      this.cookielessBotChecks = details.cookielessBotChecks;
    }
  }
}

const tabCountThrottle = new TabCountThrottle();
tabCountThrottle.THROTTLED_OUTCOME = THROTTLED_OUTCOME;

module.exports = tabCountThrottle;
