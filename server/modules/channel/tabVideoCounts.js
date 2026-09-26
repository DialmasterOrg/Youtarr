const logger = require('../../logger');
const Channel = require('../../models/channel');
const MessageEmitter = require('../messageEmitter.js');
const tabState = require('./tabState');
const tabCountSources = require('./tabCountSources');
const { MEDIA_TAB_TYPE_MAP } = require('../tabsUtils');

const COUNTS_STALE_AFTER_MS = 24 * 60 * 60 * 1000;
// After a failed on-demand refresh, opening the channel page again should not
// fire another lookup straight away (a bot check would just repeat).
const FAILED_REFRESH_COOLDOWN_MS = 60 * 60 * 1000;
// The scheduled task's key, so manual and startup runs share its history.
const TASK_KEY = 'channelVideoCountsFrequency';

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

const ALREADY_RUNNING_SUMMARY = {
  status: 'skipped',
  outcome: 'skipped',
  message: 'A channel video count refresh is already running.',
};

function summarizeRefresh({ refreshed, failed, source }) {
  const details = { refreshed, failed, source };
  if (refreshed === 0 && failed === 0) {
    return { status: 'success', outcome: 'completed', message: 'No channels needed a video count.', details };
  }
  const base = `Refreshed video counts for ${plural(refreshed, 'channel')}`;
  if (failed === 0) {
    return { status: 'success', outcome: 'completed', message: `${base}.`, details };
  }
  return {
    status: 'error',
    outcome: refreshed > 0 ? 'partial' : 'error',
    message: `${base}; ${plural(failed, 'channel')} failed.`,
    details,
  };
}

class TabVideoCounts {
  constructor() {
    this.inFlight = new Map();
    this.lastFailureAt = new Map();
    this.bulkRunning = false;
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

  isStale(channel, now = Date.now()) {
    const stored = this.getStoredCounts(channel);
    return this.countableTabs(channel).some((tab) => {
      const fetchedAt = Date.parse(stored[MEDIA_TAB_TYPE_MAP[tab]]?.fetchedAt);
      return !Number.isFinite(fetchedAt) || now - fetchedAt >= COUNTS_STALE_AFTER_MS;
    });
  }

  /**
   * Refresh one channel's counts. Overlapping calls for the same channel share
   * one lookup.
   * @param {string} channelId
   * @param {{ onlyIfStale?: boolean }} [options] - on-demand refreshes skip
   *   fresh counts and back off for an hour after a failure
   * @returns {Promise<{ status: 'refreshed'|'failed'|'fresh'|'cooldown'|'skipped' }>}
   */
  refreshChannel(channelId, { onlyIfStale = false } = {}) {
    if (this.inFlight.has(channelId)) return this.inFlight.get(channelId);
    const run = this._refreshOne(channelId, onlyIfStale)
      .finally(() => this.inFlight.delete(channelId));
    this.inFlight.set(channelId, run);
    return run;
  }

  /**
   * Refresh every subscribed channel in one batch. Only one batch runs at a
   * time; an overlapping call is reported as skipped.
   * @param {{ onlyStale?: boolean }} [options] - limit to channels whose counts
   *   are missing or at least a day old
   * @returns {Promise<{ status: string, outcome: string, message: string, details?: Object }>}
   */
  async refreshAll({ onlyStale = false } = {}) {
    if (this.bulkRunning) return { ...ALREADY_RUNNING_SUMMARY };
    this.bulkRunning = true;
    try {
      const enabled = await Channel.findAll({ where: { enabled: true } });
      const channels = onlyStale ? enabled.filter((channel) => this.isStale(channel)) : enabled;
      const result = await this._refreshMany(channels);
      if (result.refreshed > 0) {
        MessageEmitter.emitMessage('broadcast', null, 'channel', 'channelsUpdated', { text: 'Channel video counts updated' });
      }
      return summarizeRefresh(result);
    } finally {
      this.bulkRunning = false;
    }
  }

  /**
   * Startup catch-up: counts channels whose counts are missing or a day old
   * (a first run after upgrading, or a long downtime) and records the run in
   * the scheduled task's history. A run with nothing to count is not
   * recorded, so frequent restarts do not push real runs out of the history.
   * @param {{ runRecorder: { record: Function } }} deps - scheduledTaskRuns,
   *   passed in so the channel modules do not load every model
   */
  async refreshAtStartup({ runRecorder }) {
    const startedAt = new Date();
    const summary = await this.refreshAll({ onlyStale: true });
    const { refreshed = 0, failed = 0 } = summary.details || {};
    if (summary.status !== 'skipped' && refreshed === 0 && failed === 0) return summary;
    await runRecorder.record({
      taskKey: TASK_KEY,
      trigger: 'startup',
      startedAt,
      finishedAt: new Date(),
      ...summary,
    });
    return summary;
  }

  async _refreshOne(channelId, onlyIfStale) {
    const channel = await Channel.findOne({ where: { channel_id: channelId } });
    if (this.countableTabs(channel).length === 0) return { status: 'skipped' };
    if (onlyIfStale) {
      if (!this.isStale(channel)) return { status: 'fresh' };
      const failedAt = this.lastFailureAt.get(channelId);
      if (failedAt && Date.now() - failedAt < FAILED_REFRESH_COOLDOWN_MS) return { status: 'cooldown' };
    }
    const { refreshed } = await this._refreshMany([channel]);
    return { status: refreshed > 0 ? 'refreshed' : 'failed' };
  }

  async _refreshMany(channels) {
    const plans = channels
      .map((channel) => ({
        channel,
        tabs: this.countableTabs(channel).map((tab) => ({
          tab,
          playlistId: tabCountSources.tabPlaylistId(channel.channel_id, tab),
        })),
      }))
      .filter((plan) => plan.tabs.length > 0);

    const { counts, source } = await tabCountSources.fetchCounts(
      plans.flatMap((plan) => plan.tabs.map((entry) => entry.playlistId))
    );
    const fetchedAt = new Date().toISOString();
    let refreshed = 0;
    let failed = 0;

    for (const { channel, tabs } of plans) {
      const results = tabs.map((entry) => ({ ...entry, total: counts.get(entry.playlistId) }));
      const succeeded = results.filter((entry) => Number.isInteger(entry.total));
      // A channel with detected tabs cannot have every tab empty; that answer
      // means the lookup went wrong, so it must not overwrite real counts.
      const allEmpty = succeeded.length === results.length && succeeded.every((entry) => entry.total === 0);

      if (succeeded.length > 0 && !allEmpty) {
        await this._writeCounts(channel.channel_id, succeeded, fetchedAt);
      }
      if (succeeded.length === results.length && !allEmpty) {
        refreshed += 1;
        this.lastFailureAt.delete(channel.channel_id);
      } else {
        failed += 1;
        this.lastFailureAt.set(channel.channel_id, Date.now());
        logger.warn({ channelId: channel.channel_id, source, allEmpty }, 'Could not refresh channel video counts');
      }
    }

    return { refreshed, failed, source };
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
