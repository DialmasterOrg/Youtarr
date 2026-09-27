const logger = require('../../logger');
const Channel = require('../../models/channel');
const MessageEmitter = require('../messageEmitter.js');
const tabState = require('./tabState');
const tabCountSources = require('./tabCountSources');
const tabCountBackoff = require('./tabCountBackoff');
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

function describeStop({ backoff, stoppedAfterFailures, stoppedByPause }) {
  if (backoff) {
    const cause = backoff.backoffReason === 'bot-check' ? 'asked for a bot check' : 'is limiting requests';
    const paused = backoff.backoffScope === 'bulk' ? 'automatic refreshes' : 'all refreshes';
    return `. Stopped because YouTube ${cause}; ${paused} are paused for ${hoursFrom(backoff.backoffMs)}`;
  }
  if (stoppedAfterFailures) return '. Stopped after repeated failed lookups';
  if (stoppedByPause) return '. Stopped because refreshes were paused';
  return '';
}

function summarizeRefresh({
  refreshed, failed, source, remaining = 0, backoff = null, stoppedAfterFailures = false, stoppedByPause = false,
}) {
  const details = { refreshed, failed, source, remaining, ...(backoff || {}) };
  if (refreshed === 0 && failed === 0 && remaining === 0) {
    return { status: 'success', outcome: 'completed', message: 'No channels needed a video count.', details };
  }
  const failures = failed > 0 ? `; ${plural(failed, 'channel')} failed` : '';
  const later = remaining > 0 ? `. ${plural(remaining, 'channel')} left for later runs` : '';
  const message = `Refreshed video counts for ${plural(refreshed, 'channel')}${failures}${describeStop({ backoff, stoppedAfterFailures, stoppedByPause })}${later}.`;
  if (backoff) {
    return { status: 'error', outcome: tabCountBackoff.THROTTLED_OUTCOME, message, details };
  }
  if (failed === 0 && !stoppedAfterFailures) {
    return { status: 'success', outcome: 'completed', message, details };
  }
  return { status: 'error', outcome: refreshed > 0 ? 'partial' : 'error', message, details };
}

class TabVideoCounts {
  constructor() {
    this.inFlight = new Map();
    this.bulkRunning = false;
    this.runHistory = null;
  }

  /**
   * Wire the run history once the database is ready: startup runs are
   * recorded in it, and a throttled run's backoff is read back from it.
   * @param {{ record: Function, getLatestRun: Function }} runHistory -
   *   scheduledTaskRuns, passed in so the channel modules do not load every model
   */
  setRunHistory(runHistory) {
    this.runHistory = runHistory;
    tabCountBackoff.useRunHistory(runHistory, TASK_KEY);
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

      const pausedMs = await tabCountBackoff.remainingMs('bulk');
      if (pausedMs > 0) return pausedSummary(pausedMs);

      const revision = tabCountBackoff.getRevision();
      const result = await this._refreshViaYtdlp(enabled);
      if (result.throttle) {
        result.backoff = await tabCountBackoff.start({ reason: result.throttle, bulk: true });
        logger.warn({ ...result.backoff, refreshed: result.refreshed }, 'YouTube throttled the channel video count refresh; pausing refreshes');
      } else if (result.refreshed + result.failed > 0) {
        tabCountBackoff.clearIfUnchanged(revision);
      }
      return await this._finishRun(result);
    } catch (err) {
      // Resolve rather than reject so the recorded run still carries the backoff.
      logger.error({ err }, 'Channel video count refresh failed');
      return {
        status: 'error',
        outcome: 'error',
        message: err.message || 'Unknown error',
        details: await tabCountBackoff.currentDetails(),
      };
    } finally {
      this.bulkRunning = false;
    }
  }

  /**
   * Startup catch-up: counts channels whose counts are missing or old (a
   * first run after upgrading, or a long downtime) and records the run in
   * the scheduled task's history. It does not start while a download is
   * running (the scheduled run picks those channels up), and a run that was
   * skipped or had nothing to count is not recorded, so frequent restarts do
   * not push real runs out of the history.
   * @param {{ isDownloadActive?: Function }} [deps]
   */
  async refreshAtStartup({ isDownloadActive } = {}) {
    if (isDownloadActive && isDownloadActive()) {
      logger.info('Skipping the startup channel video count refresh while a download is running');
      return { status: 'skipped', outcome: 'skipped', message: 'A download was running.' };
    }
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
      if (await tabCountBackoff.remainingMs('on-demand') > 0) return { status: 'paused' };
      await this._markAttempted(channelId);
      const lookup = await tabCountSources.fetchCountsViaYtdlp(playlistIds);
      counts = lookup.counts;
      source = 'yt-dlp';
      if (lookup.throttle) {
        const backoff = await tabCountBackoff.start({ reason: lookup.throttle, bulk: false });
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
    return { ...summary, details: { ...(await tabCountBackoff.currentDetails()), ...summary.details } };
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

  async _refreshViaYtdlp(enabled) {
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
    const { stopReason } = await tabCountSources.lookupChannelsPaced(selected, {
      shouldStop: async () => (await tabCountBackoff.remainingMs('bulk')) > 0,
      onChannelStart: (plan) => this._markAttempted(plan.channel.channel_id),
      onChannelDone: async (plan, counts) => {
        if (await this._saveChannel(plan, counts, new Date().toISOString(), 'yt-dlp')) refreshed += 1;
        else failed += 1;
      },
    });

    const stoppedAfterFailures = stopReason === tabCountSources.STOPPED_AFTER_FAILURES;
    const stoppedByPause = stopReason === tabCountSources.STOPPED_BY_PAUSE;
    return {
      refreshed,
      failed,
      source: 'yt-dlp',
      remaining: candidates.length - refreshed - failed,
      throttle: stopReason && !stoppedAfterFailures && !stoppedByPause ? stopReason : null,
      stoppedAfterFailures,
      stoppedByPause,
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
