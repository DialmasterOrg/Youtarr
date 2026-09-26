import { Channel } from '../../types/Channel';

/** Settings the Add Channel dialog sets before a channel is subscribed. */
export interface NewChannelSettings {
  /** Comma-separated media types (video, short, livestream); empty means auto-download is off. */
  auto_download_enabled_tabs: string;
  video_quality: string | null;
  audio_format: string | null;
  sub_folder: string | null;
}

/** A channel waiting in the pending list until the user saves. */
export interface PendingChannel extends Channel {
  /** True when the channel was subscribed before and comes back with its saved settings. */
  restored?: boolean;
}

export const getNewChannelSettings = (channel: Channel): NewChannelSettings => ({
  auto_download_enabled_tabs: channel.auto_download_enabled_tabs ?? '',
  video_quality: channel.video_quality ?? null,
  audio_format: channel.audio_format ?? null,
  sub_folder: channel.sub_folder ?? null,
});

export const hasDetectedTabs = (channel: Channel): boolean => Boolean(channel.available_tabs?.trim());

/**
 * Settings sent with a pending channel on save. Auto-download tabs are left out
 * when tab detection found nothing: the server would drop every tab it cannot
 * see and turn auto-download off, instead of keeping its default.
 */
export const toNewChannelSettingsPayload = (channel: Channel): Partial<NewChannelSettings> => {
  const { auto_download_enabled_tabs, ...rest } = getNewChannelSettings(channel);
  return hasDetectedTabs(channel) ? { auto_download_enabled_tabs, ...rest } : rest;
};
