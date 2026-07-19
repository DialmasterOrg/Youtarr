const logger = require('../../logger');
const Channel = require('../../models/channel');
const MessageEmitter = require('../messageEmitter.js');
const youtubeApi = require('../youtubeApi');
const { TAB_TYPES, MEDIA_TAB_TYPE_MAP, parseTabCsv } = require('../tabsUtils');
const channelIdentity = require('./channelIdentity');
const channelYtdlpExecutor = require('./channelYtdlpExecutor');
const fetchRegistry = require('./fetchRegistry');
const tabState = require('./tabState');
const { logApiFallback } = require('./apiFallbackLogger');

class TabManager {
  /**
   * Check if a tab exists for a channel by probing with yt-dlp.
   * Attempts to fetch 1 entry from the tab URL. If entries exist, the tab is available.
   * @param {string} channelId - Channel ID
   * @param {string} tabType - Tab type to check ('videos', 'shorts', or 'streams')
   * @returns {Promise<boolean>} - True if tab exists
   */
  async checkTabExistsViaYtdlp(channelId, tabType) {
    const tabUrl = `${channelIdentity.resolveChannelUrlFromId(channelId)}/${tabType}`;

    try {
      const YtdlpCommandBuilder = require('../download/ytdlpCommandBuilder');
      const result = await channelYtdlpExecutor.withTempFile(`tab-check-${tabType}`, async (outputFilePath) => {
        const args = YtdlpCommandBuilder.buildMetadataFetchArgs(tabUrl, {
          flatPlaylist: true,
          playlistEnd: 1,
          skipSleepRequests: true,
        });
        const content = await channelYtdlpExecutor.executeYtDlpCommand(args, outputFilePath);
        const parsed = JSON.parse(content);
        const entries = parsed.entries || [];
        return entries.length > 0;
      });
      return result;
    } catch (error) {
      logger.debug({ channelId, tabType, error: error.message }, 'yt-dlp tab check failed');
      return false;
    }
  }

  /**
   * Detect available tabs for a channel. Prefers the YouTube Data API
   * (3 quota units) when a key is configured; falls back to yt-dlp probes
   * on any API failure or when the API returns no tabs. Return shape matches
   * _probeTabsViaYtdlp for drop-in compatibility.
   * @param {string} channelId - Channel ID to probe
   * @returns {Promise<string[]>} - Detected tab types
   * @private
   */
  async _probeTabs(channelId) {
    if (youtubeApi.isAvailable()) {
      try {
        const apiKey = youtubeApi.getApiKey();
        const channelUrl = channelIdentity.resolveChannelUrlFromId(channelId);
        const { availableTabs } = await youtubeApi.client.detectAvailableTabs(apiKey, channelUrl);

        if (availableTabs.length > 0) {
          logger.info(
            { channelId, source: 'youtube-api', availableTabs },
            'Detected channel tabs via YouTube API'
          );
          return availableTabs;
        }
        logger.info(
          { channelId },
          'YouTube API tab detection returned no tabs, falling back to yt-dlp'
        );
      } catch (apiErr) {
        logApiFallback(
          apiErr,
          { channelId },
          'YouTube API tab detection failed, falling back to yt-dlp'
        );
      }
    }

    return this._probeTabsViaYtdlp(channelId);
  }

  /**
   * Probe yt-dlp for each known tab type in parallel and return the list
   * of detected tabs. Falls back to [TAB_TYPES.VIDEOS] if all probes fail
   * so the channel stays usable. Shared by detectAndSaveChannelTabs and
   * redetectChannelTabs to avoid drift between the two probe paths.
   * @param {string} channelId - Channel ID to probe
   * @returns {Promise<string[]>} - Detected tab types
   * @private
   */
  async _probeTabsViaYtdlp(channelId) {
    const tabTypesToTest = [TAB_TYPES.VIDEOS, TAB_TYPES.SHORTS, TAB_TYPES.LIVE];
    const tabChecks = await Promise.all(
      tabTypesToTest.map(async (tabType) => {
        const exists = await this.checkTabExistsViaYtdlp(channelId, tabType);
        if (exists) {
          logger.info({ channelId, tabType }, 'Tab exists for channel');
        } else {
          logger.debug({ channelId, tabType }, 'Tab not available for channel');
        }
        return { tabType, exists };
      })
    );

    const detected = tabChecks
      .filter((result) => result.exists)
      .map((result) => result.tabType);

    if (detected.length === 0) {
      logger.warn({ channelId }, 'All tab probes failed, defaulting to videos tab');
      return [TAB_TYPES.VIDEOS];
    }

    return detected;
  }

  /**
   * Detect and save available tabs for a channel.
   * Probes each tab type in parallel via yt-dlp. Short-circuits if
   * the channel already has cached tabs (use redetectChannelTabs to
   * force a fresh probe). Uses activeFetches map to prevent
   * concurrent detection for the same channel.
   * @param {string} channelId - Channel ID to detect tabs for
   * @returns {Promise<{availableTabs: string[], autoDownloadEnabledTabs: string}|null>} - Detected tabs or null if skipped/failed
   */
  async detectAndSaveChannelTabs(channelId) {
    // Check if already detecting (use activeFetches map to prevent concurrent)
    const fetchKey = `tabs-${channelId}`;
    if (fetchRegistry.has(fetchKey)) {
      logger.debug({ channelId }, 'Tab detection already in progress, skipping');
      return null;
    }
    fetchRegistry.set(fetchKey, { startTime: new Date().toISOString(), type: 'tabDetection' });

    try {
      const channel = await Channel.findOne({ where: { channel_id: channelId } });
      if (!channel) {
        logger.warn({ channelId }, 'Channel not found for tab detection');
        return null;
      }

      // If already populated (race condition), return cached values
      if (channel.available_tabs) {
        logger.debug({ channelId }, 'Tabs already detected, returning cached');
        return {
          availableTabs: channel.available_tabs.split(','),
          autoDownloadEnabledTabs: channel.auto_download_enabled_tabs ?? 'video'
        };
      }

      logger.info({ channelId, channelTitle: channel.title }, 'Starting tab detection for channel');

      // Probe every tab type via API (if available) or yt-dlp. Helper handles
      // the fallback-to-videos behavior if all probes fail.
      const availableTabs = await this._probeTabs(channelId);

      // Reconcile the stored value against the detected tabs: keep media types whose
      // tab exists, drop the rest (this sheds the NOT NULL 'video' default on channels
      // with no videos tab). An empty string means auto-download is off, so keep it.
      const detectedMediaTypes = new Set(
        availableTabs.map((tab) => MEDIA_TAB_TYPE_MAP[tab]).filter(Boolean)
      );
      const existingEnabledTabs = channel.auto_download_enabled_tabs;
      const reconciledTabs = parseTabCsv(existingEnabledTabs).filter((mt) => detectedMediaTypes.has(mt));

      let autoDownloadEnabledTabs;
      if (reconciledTabs.length > 0) {
        autoDownloadEnabledTabs = reconciledTabs.join(',');
      } else if (existingEnabledTabs === '') {
        autoDownloadEnabledTabs = '';
      } else {
        // Nothing survived: default to the videos tab, or the first available tab.
        autoDownloadEnabledTabs = 'video';
        if (!availableTabs.includes(TAB_TYPES.VIDEOS) && availableTabs.length > 0) {
          autoDownloadEnabledTabs = MEDIA_TAB_TYPE_MAP[availableTabs[0]] || 'video';
          logger.info({ channelId, defaultTab: autoDownloadEnabledTabs }, 'Channel has no videos tab, using alternative default');
        }
      }

      // Update channel with detected tabs
      await Channel.update(
        {
          available_tabs: availableTabs.length > 0 ? availableTabs.join(',') : null,
          auto_download_enabled_tabs: autoDownloadEnabledTabs
        },
        { where: { channel_id: channelId } }
      );

      logger.info({ channelId, availableTabs, autoDownloadEnabledTabs }, 'Tab detection completed');

      // Emit WebSocket update so frontend can refresh
      MessageEmitter.emitMessage('broadcast', null, 'channel', 'channelTabsDetected', {
        channelId,
        availableTabs,
        autoDownloadEnabledTabs
      });

      return { availableTabs, autoDownloadEnabledTabs };
    } catch (err) {
      logger.error({ err, channelId }, 'Tab detection failed');
      return null;
    } finally {
      fetchRegistry.delete(fetchKey);
    }
  }

  /**
   * Force a fresh yt-dlp probe of a channel's tabs, bypassing any cached
   * available_tabs value. Preserves the user's hidden_tabs selection and
   * rewrites auto_download_enabled_tabs to drop any tabs that are no
   * longer detected or are currently hidden.
   *
   * Concurrent calls for the same channel collapse to a single yt-dlp
   * burst via the activeFetches map: a second caller receives the
   * existing in-flight promise instead of spawning its own probe. This
   * bounds at most one probe burst per channel in flight at any time.
   *
   * Use this when a channel's cached available_tabs is known to be stale
   * (e.g. the RSS-era detection wrote a wrong value) and the user wants
   * to re-run detection from the UI.
   *
   * @param {string} channelId - Channel ID to re-detect
   * @returns {Promise<{availableTabs: string[], detectedTabs: string[], hiddenTabs: string[], autoDownloadEnabledTabs: string}>}
   */
  async redetectChannelTabs(channelId) {
    const fetchKey = `redetect-tabs-${channelId}`;
    const existing = fetchRegistry.get(fetchKey);
    if (existing && existing.promise) {
      logger.debug({ channelId }, 'redetectChannelTabs already running, awaiting in-flight probe');
      return existing.promise;
    }

    const promise = this._redetectChannelTabsInner(channelId);
    fetchRegistry.set(fetchKey, {
      startTime: new Date().toISOString(),
      type: 'tabRedetection',
      promise,
    });

    try {
      return await promise;
    } finally {
      fetchRegistry.delete(fetchKey);
    }
  }

  /**
   * Inner implementation of the redetect flow. Always executes a yt-dlp
   * probe and database update. Do not call directly; go through
   * redetectChannelTabs so the concurrency guard applies.
   * @param {string} channelId - Channel ID to re-detect
   * @returns {Promise<{availableTabs: string[], detectedTabs: string[], hiddenTabs: string[], autoDownloadEnabledTabs: string}>}
   * @private
   */
  async _redetectChannelTabsInner(channelId) {
    const channel = await Channel.findOne({ where: { channel_id: channelId } });
    if (!channel) {
      throw new Error('Channel not found in database');
    }

    logger.info({ channelId, channelTitle: channel.title }, 'Forcing tab re-detection for channel');

    const detectedTabs = await this._probeTabs(channelId);
    const hiddenTabs = parseTabCsv(channel.hidden_tabs);

    // Compute effective tabs (what the user actually sees)
    const effectiveTabs = tabState.computeEffectiveTabs(detectedTabs.join(','), channel.hidden_tabs);

    // Rewrite auto_download_enabled_tabs: keep only entries whose
    // corresponding tabType is both detected AND not hidden.
    const validMediaTypes = new Set(effectiveTabs.map((tabType) => MEDIA_TAB_TYPE_MAP[tabType]).filter(Boolean));
    const existingAutoTabs = parseTabCsv(channel.auto_download_enabled_tabs);
    const filteredAutoTabs = existingAutoTabs.filter((mt) => validMediaTypes.has(mt));
    const newAutoDownloadEnabledTabs = filteredAutoTabs.join(',');

    await Channel.update(
      {
        available_tabs: detectedTabs.join(','),
        auto_download_enabled_tabs: newAutoDownloadEnabledTabs
      },
      { where: { channel_id: channelId } }
    );

    logger.info(
      { channelId, detectedTabs, hiddenTabs, effectiveTabs, autoDownloadEnabledTabs: newAutoDownloadEnabledTabs },
      'Tab re-detection completed'
    );

    MessageEmitter.emitMessage('broadcast', null, 'channel', 'channelTabsDetected', {
      channelId,
      availableTabs: effectiveTabs,
      autoDownloadEnabledTabs: newAutoDownloadEnabledTabs
    });

    return {
      availableTabs: effectiveTabs,
      detectedTabs,
      hiddenTabs,
      autoDownloadEnabledTabs: newAutoDownloadEnabledTabs
    };
  }

  /**
   * Get available tabs for a channel.
   * Returns cached result if available (filtered through hidden_tabs),
   * otherwise detects tabs now via yt-dlp probing.
   * @param {string} channelId - Channel ID to get tabs for
   * @returns {Promise<Object>} - Object with availableTabs array (effective set)
   */
  async getChannelAvailableTabs(channelId) {
    const channel = await Channel.findOne({
      where: { channel_id: channelId },
    });

    if (!channel) {
      throw new Error('Channel not found in database');
    }

    // Fast path: return cached tabs (filtered through hidden_tabs)
    if (channel.available_tabs) {
      return {
        availableTabs: tabState.computeEffectiveTabs(channel.available_tabs, channel.hidden_tabs),
      };
    }

    // No tabs cached - detect them now via yt-dlp probing
    const result = await this.detectAndSaveChannelTabs(channelId);
    const detectedTabs = result?.availableTabs || [];
    const hiddenTabsCsv = channel.hidden_tabs || null;

    return {
      availableTabs: tabState.computeEffectiveTabs(detectedTabs.join(','), hiddenTabsCsv),
    };
  }

  /**
   * Update the auto download setting for a specific tab type for a channel
   * @param {string} channelId - Channel ID
   * @param {string} tabType - Tab type ('videos', 'shorts', or 'streams')
   * @param {boolean} enabled - Whether to enable auto downloads for this tab
   */
  async updateAutoDownloadForTab(channelId, tabType, enabled) {
    const channel = await Channel.findOne({
      where: { channel_id: channelId },
    });

    if (!channel) {
      throw new Error('Channel not found in database');
    }

    // Convert tabType to mediaType
    const mediaType = MEDIA_TAB_TYPE_MAP[tabType] || 'video';

    // Get current enabled tabs
    const currentEnabledTabs = (channel.auto_download_enabled_tabs ?? 'video')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    let newEnabledTabs;
    if (enabled) {
      // Add mediaType if not already present
      if (!currentEnabledTabs.includes(mediaType)) {
        newEnabledTabs = [...currentEnabledTabs, mediaType];
      } else {
        newEnabledTabs = currentEnabledTabs;
      }
    } else {
      // Remove mediaType
      newEnabledTabs = currentEnabledTabs.filter(t => t !== mediaType);
    }

    // Update the channel (empty string if no tabs are enabled)
    channel.auto_download_enabled_tabs = newEnabledTabs.join(',');
    await channel.save();

    logger.info({
      channelId,
      tabType,
      enabled,
      autoDownloadEnabledTabs: channel.auto_download_enabled_tabs
    }, 'Updated auto download setting for channel tab');
  }
}

module.exports = new TabManager();
