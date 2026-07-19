const tabState = require('./tabState');

class ChannelMappers {
  /**
   * Map channel database record to response format
   * @param {Object} channel - Channel database record
   * @returns {Object} - Formatted channel response
   */
  mapChannelToResponse(channel) {
    const effectiveTabs = tabState.computeEffectiveTabs(channel.available_tabs, channel.hidden_tabs);
    const out = {
      id: channel.channel_id,
      uploader: channel.uploader,
      uploader_id: channel.uploader_id || channel.channel_id,
      title: channel.title,
      description: channel.description,
      url: channel.url,
      enabled: !!channel.enabled,
      auto_download_enabled_tabs: channel.auto_download_enabled_tabs ?? 'video',
      available_tabs: effectiveTabs.length > 0 ? effectiveTabs.join(',') : null,
      sub_folder: channel.sub_folder || null,
      video_quality: channel.video_quality || null,
      audio_format: channel.audio_format || null,
      min_duration: channel.min_duration || null,
      max_duration: channel.max_duration || null,
      title_filter_regex: channel.title_filter_regex || null,
      terminated_at: channel.terminated_at || null,
    };

    if (channel.default_rating != null) {
      out.default_rating = channel.default_rating;
    }

    return out;
  }

  /**
   * Map channel database record to list response format expected by the UI
   * @param {Object} channel - Channel database record
   * @returns {Object} - Simplified channel representation
   */
  mapChannelListEntry(channel) {
    const effectiveTabs = tabState.computeEffectiveTabs(channel.available_tabs, channel.hidden_tabs);
    const out = {
      url: channel.url,
      uploader: channel.uploader || '',
      channel_id: channel.channel_id || '',
      auto_download_enabled_tabs: channel.auto_download_enabled_tabs ?? 'video',
      available_tabs: effectiveTabs.length > 0 ? effectiveTabs.join(',') : null,
      sub_folder: channel.sub_folder || null,
      video_quality: channel.video_quality || null,
      min_duration: channel.min_duration || null,
      max_duration: channel.max_duration || null,
      title_filter_regex: channel.title_filter_regex || null,
      audio_format: channel.audio_format || null,
      terminated_at: channel.terminated_at || null,
    };

    if (channel.default_rating != null) {
      out.default_rating = channel.default_rating;
    }

    return out;
  }
}

module.exports = new ChannelMappers();
