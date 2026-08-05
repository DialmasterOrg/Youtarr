const fs = require('fs-extra');
const path = require('path');
const logger = require('../../logger');
const configModule = require('../configModule');
const Channel = require('../../models/channel');
const channelMetadataFetcher = require('./channelMetadataFetcher');
const channelThumbnails = require('./channelThumbnails');

// Space out banner fetches so a sweep over a large channel list doesn't hammer YouTube.
const SWEEP_DELAY_BETWEEN_FETCHES_MS = 1000;

class ChannelBackdropBackfill {
  constructor() {
    this.sweepInProgress = false;
    this.lastEnabledState = false;
  }

  subscribe() {
    this.lastEnabledState = configModule.getConfig()?.writeBackdropImages === true;
    configModule.onConfigChange(this.handleConfigChange.bind(this));
  }

  handleConfigChange() {
    const enabled = configModule.getConfig()?.writeBackdropImages === true;
    const wasEnabled = this.lastEnabledState;
    this.lastEnabledState = enabled;
    if (!wasEnabled && enabled) {
      this.runSweep().catch((err) => {
        logger.error({ err }, 'Channel backdrop backfill sweep failed');
      });
    }
  }

  /**
   * Fetch and cache banners for enabled channels missing one, then backfill
   * channel folder images. Idempotent: cached banners are skipped.
   */
  async runSweep() {
    if (this.sweepInProgress) {
      logger.info('Channel backdrop sweep already running, skipping');
      return;
    }
    this.sweepInProgress = true;
    try {
      const channels = await Channel.findAll({ where: { enabled: true } });
      const imageDir = configModule.getImagePath();

      for (const channel of channels) {
        if (!channel.channel_id) continue;

        const bannerCachePath = path.join(imageDir, `channelbanner-${channel.channel_id}.jpg`);
        if (fs.existsSync(bannerCachePath)) continue;

        try {
          const channelUrl = channel.url || `https://www.youtube.com/channel/${channel.channel_id}`;
          const channelData = await channelMetadataFetcher.fetchChannelMetadata(channelUrl);
          await channelThumbnails.processChannelBanner(channelData, channel.channel_id);
        } catch (err) {
          logger.warn({ err, channelId: channel.channel_id }, 'Failed to fetch banner during backdrop sweep');
        }

        await new Promise((resolve) => setTimeout(resolve, SWEEP_DELAY_BETWEEN_FETCHES_MS));
      }

      await channelThumbnails.backfillChannelImages(channels);
      logger.info({ channelCount: channels.length }, 'Channel backdrop backfill sweep complete');
    } finally {
      this.sweepInProgress = false;
    }
  }
}

module.exports = new ChannelBackdropBackfill();
