const configModule = require('../configModule');

const BASE_BACKOFF_MS = 6 * 60 * 60 * 1000;
const MAX_BACKOFF_MS = 24 * 60 * 60 * 1000;
// The outcome a bulk run records when YouTube pushed back.
const THROTTLED_OUTCOME = 'throttled';
// Run statuses of refreshes that actually ran (not skipped or interrupted).
const EXECUTED_STATUSES = ['success', 'error'];

const SCOPE = {
  // Bulk refreshes only: they go without cookies, so a bot check there says
  // nothing about lookups that send the user's cookies.
  BULK: 'bulk',
  // Every refresh, on-demand ones included.
  ALL: 'all',
};

/**
 * When YouTube throttles tab count lookups (a 429, "try again later", or a
 * bot check), refreshes pause for 6 hours, doubling up to 24 hours while
 * bulk runs keep getting throttled. Every bulk run that runs records the
 * current backoff in its run details (currentDetails), so the latest
 * executed run always carries it across a restart, whatever its outcome.
 */
class TabCountBackoff {
  constructor() {
    this.state = null;
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
    if (!this.state) return 0;
    if (kind !== 'bulk' && this.state.scope !== SCOPE.ALL) return 0;
    return Math.max(0, this.state.until - now);
  }

  /**
   * Start a backoff after YouTube pushed back.
   * @param {{ reason: 'bot-check'|'rate-limit', bulk: boolean }} throttle
   * @returns {Promise<{ backoffReason: string, backoffScope: string,
   *   backoffMs: number, backoffUntil: string }>} the run record details
   */
  async start({ reason, bulk }, now = Date.now()) {
    await this._load();
    const previous = this.state;
    const botCheckWithoutCookies = reason === 'bot-check' && bulk && Boolean(configModule.getCookiesPath());
    const stillPausedForAll = previous && previous.until > now && previous.scope === SCOPE.ALL;
    const scope = botCheckWithoutCookies && !stillPausedForAll ? SCOPE.BULK : SCOPE.ALL;
    const durationMs = previous ? Math.min(previous.durationMs * 2, MAX_BACKOFF_MS) : BASE_BACKOFF_MS;
    this.state = { until: now + durationMs, scope, durationMs };
    this.revision += 1;
    return {
      backoffReason: reason,
      backoffScope: scope,
      backoffMs: durationMs,
      backoffUntil: new Date(this.state.until).toISOString(),
    };
  }

  getRevision() {
    return this.revision;
  }

  /**
   * End the doubling after a bulk run that looked channels up without being
   * throttled, unless a throttle (from an overlapping on-demand lookup)
   * started a newer backoff while it ran.
   * @param {number} revision - getRevision() from when the run started
   */
  clearIfUnchanged(revision) {
    if (this.revision === revision) this.state = null;
  }

  /**
   * The backoff to record in a run's details, including an expired one that
   * still counts toward doubling; {} once cleared.
   * @returns {Promise<Object>}
   */
  async currentDetails() {
    await this._load();
    if (!this.state) return {};
    return {
      backoffScope: this.state.scope,
      backoffMs: this.state.durationMs,
      backoffUntil: new Date(this.state.until).toISOString(),
    };
  }

  async _load() {
    if (!this.loading) this.loading = this._readLatestRun();
    return this.loading;
  }

  async _readLatestRun() {
    if (!this.runHistory) return;
    const run = await this.runHistory.getLatestRun(this.taskKey, { statuses: EXECUTED_STATUSES });
    // A throttle recorded in memory while the history was being read is newer.
    if (this.state || !run) return;
    const { backoffUntil, backoffScope, backoffMs } = run.details || {};
    const until = Date.parse(backoffUntil);
    if (!Number.isFinite(until) || !Object.values(SCOPE).includes(backoffScope)) return;
    const durationMs = Number.isFinite(backoffMs) && backoffMs > 0 ? backoffMs : BASE_BACKOFF_MS;
    this.state = { until, scope: backoffScope, durationMs };
  }
}

const tabCountBackoff = new TabCountBackoff();
tabCountBackoff.THROTTLED_OUTCOME = THROTTLED_OUTCOME;

module.exports = tabCountBackoff;
