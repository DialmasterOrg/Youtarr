const logger = require('../../logger');
const Channel = require('../../models/channel');
const MessageEmitter = require('../messageEmitter.js');
const tabState = require('./tabState');
const tabCountSources = require('./tabCountSources');
const tabCountThrottle = require('./tabCountThrottle');
const scheduledTaskManager = require('../scheduledTaskManager');
const { MEDIA_TAB_TYPE_MAP } = require('../tabsUtils');

const COUNTS_STALE_AFTER_MS = 24 * 60 * 60 * 1000;
// Without an API key, a bulk run only recounts channels whose counts (and
// last attempt) are this old, oldest attempt first, and stops at a whole
// channel once it reaches the lookup cap; later runs continue from there.
const BULK_STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const BULK_MAX_LOOKUPS_PER_RUN = 200;
// After an on-demand attempt that left the counts stale, opening the channel
// page again should not fire another lookup straight away (a bot check would
// just repeat).
const FAILED_REFRESH_COOLDOWN_MS = 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;
// The scheduled task's key, so manual and startup runs share its history.
const TASK_KEY = 'channelVideoCountsFrequency';

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function hoursFrom(ms) {
  return plural(Math.ceil(ms / MS_PER_HOUR), 'hour');
}

const ALREADY_RUNNING_SUMMARY = {
  status: 'skipped',
  outcome: 'skipped',
  message: 'A channel video count refresh is already running.',
};

function pausedSummary(remainingMs) {
  return {
    status: 'skipped',
    outcome: 'skipped',
    message: `Paused for another ${hoursFrom(remainingMs)} after YouTube limited requests.`,
  };
}

// Why a yt-dlp bulk run ended before its last channel, besides a throttle.
const STOP_REASON = {
  FAILURES: tabCountSources.STOPPED_AFTER_FAILURES,
  PAUSED: 'paused',
  DOWNLOAD: 'download',
};

function describeBackoff(backoff) {
  if (backoff.backoffScope === 'bulk') {
    return `. Stopped because YouTube asked for a bot check on a lookup without cookies (automatic refreshes don't send cookies); automatic refreshes are paused for ${hoursFrom(backoff.backoffMs)}, and channel pages you open are still counted with your cookies`;
  }
  const cause = backoff.backoffReason === 'bot-check' ? 'asked for a bot check' : 'is limiting requests';
  return `. Stopped because YouTube ${cause}; all refreshes are paused for ${hoursFrom(backoff.backoffMs)}`;
}

function describeStop({ backoff, stopReason }) {
  if (backoff) return describeBackoff(backoff);
  if (stopReason === STOP_REASON.FAILURES) return '. Stopped after repeated failed lookups';
  if (stopReason === STOP_REASON.PAUSED) return '. Stopped because refreshes were paused';
  if (stopReason === STOP_REASON.DOWNLOAD) return '. Stopped because a download was running';
  return '';
}

function summarizeRefresh({
  refreshed, failed, source, remaining = 0, backoff = null, stopReason = null, switchedToCookies = false,
}) {
  const details = { refreshed, failed, source, remaining, ...(backoff || {}) };
  if (refreshed === 0 && failed === 0 && remaining === 0) {
    return { status: 'success', outcome: 'completed', message: 'No channels needed a video count.', details };
  }
  const failures = failed > 0 ? `; ${plural(failed, 'channel')} failed` : '';
  const switched = switchedToCookies ? '. Automatic refreshes will send your cookies from now on' : '';
  const later = remaining > 0 ? `. ${plural(remaining, 'channel')} left for later runs` : '';
  const message = `Refreshed video counts for ${plural(refreshed, 'channel')}${failures}${describeStop({ backoff, stopReason })}${switched}${later}.`;
  if (backoff) {
    return { status: 'error', outcome: tabCountThrottle.THROTTLED_OUTCOME, message, details };
  }
  if (failed === 0 && stopReason !== STOP_REASON.FAILURES) {
    return { status: 'success', outcome: 'completed', message, details };
  }
  return { status: 'error', outcome: refreshed > 0 ? 'partial' : 'error', message, details };
}

class TabVideoCounts {
  constructor() {
    this.inFlight = new Map();
    this.bulkRunning = false;
    this.runHistory = null;
    this.isDownloadActive = () => false;
  }

  /**
   * Wire the run history once the database is ready: startup runs are
   * recorded in it, and a throttled run's backoff is read back from it.
   * @param {{ record: Function, getLatestRun: Function }} runHistory -
   *   scheduledTaskRuns, passed in so the channel modules do not load every model
   */
  setRunHistory(runHistory) {
    this.runHistory = runHistory;
    tabCountThrottle.useRunHistory(runHistory, TASK_KEY);
  }

  /**
   * Bulk yt-dlp runs stop at the next channel while a download is running,
   * so their lookups do not interleave with the download's requests.
   * @param {Function} isDownloadActive - () => boolean, passed in so the
   *   channel modules do not load the job queue
   */
  setDownloadActivityCheck(isDownloadActive) {
    this.isDownloadActive = isDownloadActive;
  }

  /**
   * Stored YouTube totals keyed by media type, or {} when unset or unreadable.
   * @param {Object|null} channel - Channel row
   * @returns {Object<string, { total: number, fetchedAt: string }>}
   */
  getStoredCounts(channel) {
    if (!channel || !channel.tab_video_counts) return {};
    try {
      const parsed = JSON.parse(channel.tab_video_counts);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (err) {
      logger.warn({ err, channelId: channel.channel_id }, 'Ignoring unreadable tab_video_counts');
      return {};
    }
  }

  /**
   * Effective (detected minus hidden) tabs that have an auto-generated
   * playlist to count. Terminated channels have none left to count.
   * @param {Object|null} channel - Channel row
   * @returns {string[]}
   */
  countableTabs(channel) {
    if (!channel || channel.terminated_at) return [];
    return tabState.computeEffectiveTabs(channel.available_tabs, channel.hidden_tabs)
      .filter((tab) => tabCountSources.tabPlaylistId(channel.channel_id, tab) !== null);
  }

  isStale(channel, now = Date.now(), staleAfterMs = COUNTS_STALE_AFTER_MS) {
    const stored = this.getStoredCounts(channel);
    return this.countableTabs(channel).some((tab) => {
      const fetchedAt = Date.parse(stored[MEDIA_TAB_TYPE_MAP[tab]]?.fetchedAt);
      return !Number.isFinite(fetchedAt) || now - fetchedAt >= staleAfterMs;
    });
  }

  /**
   * Refresh one channel's counts. Overlapping calls for the same channel share
   * one lookup. No yt-dlp lookup starts while YouTube throttling has paused
   * every refresh; the stored counts keep being served.
   * @param {string} channelId
   * @param {{ onlyIfStale?: boolean }} [options] - on-demand refreshes skip
   *   fresh counts and back off for an hour after an attempt
   * @returns {Promise<{ status: 'refreshed'|'failed'|'fresh'|'cooldown'|'paused'|'skipped' }>}
   */
  refreshChannel(channelId, { onlyIfStale = false } = {}) {
    if (this.inFlight.has(channelId)) return this.inFlight.get(channelId);
    const run = this._refreshOne(channelId, onlyIfStale)
      .finally(() => this.inFlight.delete(channelId));
    this.inFlight.set(channelId, run);
    return run;
  }

  /**
   * Refresh subscribed channels in one run. Only one run happens at a time;
   * an overlapping call, or a yt-dlp run while YouTube throttling has paused
   * bulk refreshes, is reported as skipped.
   *
   * With an API key every enabled channel is counted (or only those whose
   * counts are a day old, with onlyStale). Without one, or when the API call
   * fails, yt-dlp counts a capped, paced batch of channels whose counts are
   * three days old, oldest attempt first.
   * @param {{ onlyStale?: boolean }} [options]
   * @returns {Promise<{ status: string, outcome: string, message: string, details?: Object }>}
   */
  async refreshAll({ onlyStale = false } = {}) {
    if (this.bulkRunning) return { ...ALREADY_RUNNING_SUMMARY };
    this.bulkRunning = true;
    try {
      const enabled = await Channel.findAll({ where: { enabled: true } });
      if (tabCountSources.isApiAvailable()) {
        const channels = onlyStale ? enabled.filter((channel) => this.isStale(channel)) : enabled;
        const apiResult = await this._refreshViaApi(channels);
        if (apiResult) return await this._finishRun(apiResult);
      }

      const pausedMs = await tabCountThrottle.remainingMs('bulk');
      if (pausedMs > 0) return pausedSummary(pausedMs);

      const revision = tabCountThrottle.getRevision();
      const withCookies = await tabCountThrottle.bulkUsesCookies();
      const result = await this._refreshViaYtdlp(enabled, withCookies);
      if (result.refreshed + result.failed > 0) {
        const { switchedToCookies } = tabCountThrottle.recordBulkRun({
          sentCookies: withCookies,
          counted: result.tabsCounted > 0,
          botCheck: result.throttle === 'bot-check',
        });
        result.switchedToCookies = switchedToCookies;
        if (switchedToCookies) logger.warn('YouTube bot-checked repeated tab count refreshes without cookies; automatic refreshes will send cookies');
      }
      if (result.throttle) {
        result.backoff = await tabCountThrottle.start({ reason: result.throttle, sentCookies: withCookies });
        logger.warn({ ...result.backoff, refreshed: result.refreshed }, 'YouTube throttled the channel video count refresh; pausing refreshes');
      } else if (result.refreshed + result.failed > 0) {
        tabCountThrottle.clearIfUnchanged(revision);
      }
      return await this._finishRun(result);
    } catch (err) {
      // Resolve rather than reject so the recorded run still carries the backoff.
      logger.error({ err }, 'Channel video count refresh failed');
      return {
        status: 'error',
        outcome: 'error',
        message: err.message || 'Unknown error',
        details: await tabCountThrottle.currentDetails(),
      };
    } finally {
      this.bulkRunning = false;
    }
  }

  isBulkRunning() {
    return this.bulkRunning;
  }

  /**
   * Why a manual bulk refresh would do nothing right now. Only the yt-dlp
   * path can be held up: the API path ignores throttle pauses and downloads.
   * @returns {Promise<null|{ reason: string, message: string, availableAt: Date|null }>}
   */
  async getBulkRunBlocker(now = Date.now()) {
    if (tabCountSources.isApiAvailable()) return null;
    const pausedMs = await tabCountThrottle.remainingMs('bulk', now);
    if (pausedMs > 0) {
      return {
        reason: 'youtube-throttled',
        message: 'YouTube limited channel lookups, so video count refreshes are paused.',
        availableAt: new Date(now + pausedMs),
      };
    }
    if (this.isDownloadActive()) {
      return {
        reason: 'downloads-active',
        message: 'Video counts are looked up after the current download finishes.',
        availableAt: null,
      };
    }
    return null;
  }

  /**
   * Startup catch-up (see _refreshAtStartup). It runs outside the scheduler
   * two minutes after boot, often after the browser has reconnected, so it
   * tells open Scheduling pages when it starts and ends.
   */
  refreshAtStartup() {
    return scheduledTaskManager.announceRun(TASK_KEY, this._refreshAtStartup());
  }

  /**
   * Startup catch-up: counts channels whose counts are missing or old (a
   * first run after upgrading, or a long downtime) and records the run in
   * the scheduled task's history. Like any bulk run it stops while a
   * download is running. A run that was skipped or counted nothing is not
   * recorded, so frequent restarts do not push real runs out of the history.
   */
  async _refreshAtStartup() {
    const startedAt = new Date();
    const summary = await this.refreshAll({ onlyStale: true });
    const { refreshed = 0, failed = 0 } = summary.details || {};
    if (summary.status === 'skipped' || (refreshed === 0 && failed === 0)) return summary;
    if (this.runHistory) {
      await this.runHistory.record({
        taskKey: TASK_KEY,
        trigger: 'startup',
        startedAt,
        finishedAt: new Date(),
        ...summary,
      });
    }
    return summary;
  }

  async _refreshOne(channelId, onlyIfStale) {
    const channel = await Channel.findOne({ where: { channel_id: channelId } });
    const plan = this._plan(channel);
    if (plan.tabs.length === 0) return { status: 'skipped' };
    if (onlyIfStale) {
      if (!this.isStale(channel)) return { status: 'fresh' };
      const attemptedAt = this._attemptedAt(channel);
      if (attemptedAt !== null && Date.now() - attemptedAt < FAILED_REFRESH_COOLDOWN_MS) return { status: 'cooldown' };
    }

    const playlistIds = this._playlistIds([plan]);
    let counts = null;
    let source = 'api';
    if (tabCountSources.isApiAvailable()) {
      await this._markAttempted(channelId);
      counts = await tabCountSources.fetchCountsViaApi(playlistIds);
    }
    if (!counts) {
      if (await tabCountThrottle.remainingMs('on-demand') > 0) return { status: 'paused' };
      await this._markAttempted(channelId);
      const lookup = await tabCountSources.fetchCountsViaYtdlp(playlistIds);
      counts = lookup.counts;
      source = 'yt-dlp';
      if (lookup.throttle) {
        const backoff = await tabCountThrottle.start({ reason: lookup.throttle, sentCookies: true });
        logger.warn({ ...backoff, channelId }, 'YouTube throttled a channel video count lookup; pausing refreshes');
      }
    }
    const refreshed = await this._saveChannel(plan, counts, new Date().toISOString(), source);
    return { status: refreshed ? 'refreshed' : 'failed' };
  }

  // Every run that ran records the current backoff, so the latest executed
  // run restores it after a restart even when this run was empty.
  async _finishRun(result) {
    if (result.refreshed > 0) {
      MessageEmitter.emitMessage('broadcast', null, 'channel', 'channelsUpdated', { text: 'Channel video counts updated' });
    }
    const summary = summarizeRefresh(result);
    return { ...summary, details: { ...(await tabCountThrottle.currentDetails()), ...summary.details } };
  }

  // Resolves null when the API call failed, so the caller falls back to yt-dlp.
  async _refreshViaApi(channels) {
    const plans = channels.map((channel) => this._plan(channel)).filter((plan) => plan.tabs.length > 0);
    const counts = await tabCountSources.fetchCountsViaApi(this._playlistIds(plans));
    if (!counts) return null;

    const fetchedAt = new Date().toISOString();
    let refreshed = 0;
    let failed = 0;
    for (const plan of plans) {
      if (await this._saveChannel(plan, counts, fetchedAt, 'api')) refreshed += 1;
      else failed += 1;
    }
    return { refreshed, failed, source: 'api', remaining: 0, throttle: null };
  }

  async _refreshViaYtdlp(enabled, withCookies) {
    const now = Date.now();
    const candidates = enabled
      .filter((channel) => this.isStale(channel, now, BULK_STALE_AFTER_MS))
      .filter((channel) => {
        const attemptedAt = this._attemptedAt(channel);
        return attemptedAt === null || now - attemptedAt >= BULK_STALE_AFTER_MS;
      })
      .map((channel) => this._plan(channel))
      .filter((plan) => plan.tabs.length > 0)
      .sort((a, b) => (this._attemptedAt(a.channel) ?? 0) - (this._attemptedAt(b.channel) ?? 0));

    // Whole channels only, so a run never leaves a channel half counted.
    const selected = [];
    let lookups = 0;
    for (const plan of candidates) {
      if (lookups + plan.tabs.length > BULK_MAX_LOOKUPS_PER_RUN) break;
      selected.push(plan);
      lookups += plan.tabs.length;
    }

    let refreshed = 0;
    let failed = 0;
    let tabsCounted = 0;
    const { stopReason } = await tabCountSources.lookupChannelsPaced(selected, {
      withCookies,
      stopBeforeChannel: async () => (this.isDownloadActive() ? STOP_REASON.DOWNLOAD : null),
      stopBeforeLookup: async () => ((await tabCountThrottle.remainingMs('bulk')) > 0 ? STOP_REASON.PAUSED : null),
      onChannelStart: (plan) => this._markAttempted(plan.channel.channel_id),
      onChannelDone: async (plan, counts) => {
        tabsCounted += counts.size;
        if (await this._saveChannel(plan, counts, new Date().toISOString(), 'yt-dlp')) refreshed += 1;
        else failed += 1;
      },
    });

    const throttled = stopReason === 'bot-check' || stopReason === 'rate-limit';
    return {
      refreshed,
      failed,
      source: 'yt-dlp',
      remaining: candidates.length - refreshed - failed,
      tabsCounted,
      throttle: throttled ? stopReason : null,
      stopReason: throttled ? null : stopReason,
    };
  }

  _plan(channel) {
    return {
      channel,
      tabs: this.countableTabs(channel).map((tab) => ({
        tab,
        playlistId: tabCountSources.tabPlaylistId(channel.channel_id, tab),
      })),
    };
  }

  _playlistIds(plans) {
    return plans.flatMap((plan) => plan.tabs.map((entry) => entry.playlistId));
  }

  _attemptedAt(channel) {
    const attemptedAt = channel?.tab_counts_attempted_at ? new Date(channel.tab_counts_attempted_at).getTime() : NaN;
    return Number.isFinite(attemptedAt) ? attemptedAt : null;
  }

  // Stamped when the lookup starts, so a lookup cut short by a restart still
  // moves the channel to the back of the bulk rotation.
  async _markAttempted(channelId) {
    await Channel.update(
      { tab_counts_attempted_at: new Date() },
      { where: { channel_id: channelId } }
    );
  }

  /**
   * Save one channel's looked-up counts.
   * @returns {Promise<boolean>} true when every tab was counted
   */
  async _saveChannel({ channel, tabs }, counts, fetchedAt, source) {
    const results = tabs.map((entry) => ({ ...entry, total: counts.get(entry.playlistId) }));
    const succeeded = results.filter((entry) => Number.isInteger(entry.total));
    // A channel with detected tabs cannot have every tab empty; that answer
    // means the lookup went wrong, so it must not overwrite real counts.
    const allEmpty = succeeded.length === results.length && succeeded.every((entry) => entry.total === 0);

    if (succeeded.length > 0 && !allEmpty) {
      await this._writeCounts(channel.channel_id, succeeded, fetchedAt);
    }
    if (succeeded.length === results.length && !allEmpty) return true;
    logger.warn({ channelId: channel.channel_id, source, allEmpty }, 'Could not refresh channel video counts');
    return false;
  }

  async _writeCounts(channelId, results, fetchedAt) {
    // Re-read so tabs this lookup did not cover keep their stored counts.
    const current = await Channel.findOne({
      where: { channel_id: channelId },
      attributes: ['id', 'channel_id', 'tab_video_counts'],
    });
    const merged = { ...this.getStoredCounts(current) };
    for (const { tab, total } of results) {
      merged[MEDIA_TAB_TYPE_MAP[tab]] = { total, fetchedAt };
    }
    await Channel.update(
      { tab_video_counts: JSON.stringify(merged) },
      { where: { channel_id: channelId } }
    );
  }
}

module.exports = new TabVideoCounts();
