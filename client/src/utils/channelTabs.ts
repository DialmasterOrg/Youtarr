import { ChannelTabType } from '../types/Channel';

interface ChannelTabDefinition {
  label: string;
  // What the channel's auto-download setting calls the tab's videos.
  mediaType: string;
  // The tab's switch in the auto-download settings.
  autoDownloadLabel: string;
}

// The channel tabs Youtarr knows, in display order. A new ChannelTabType needs
// an entry here, and in every other map typed by it, before the client compiles.
export const CHANNEL_TABS: Record<ChannelTabType, ChannelTabDefinition> = {
  videos: { label: 'Videos', mediaType: 'video', autoDownloadLabel: 'New Videos' },
  shorts: { label: 'Shorts', mediaType: 'short', autoDownloadLabel: 'New Shorts' },
  streams: { label: 'Live', mediaType: 'livestream', autoDownloadLabel: 'New Live/Streams' },
};

export const CHANNEL_TAB_TYPES = Object.keys(CHANNEL_TABS) as ChannelTabType[];

export const isChannelTab = (tabType: string): tabType is ChannelTabType =>
  Object.prototype.hasOwnProperty.call(CHANNEL_TABS, tabType);

// A tab type this file does not know is shown as it is.
export function getTabLabel(tabType: string): string {
  return isChannelTab(tabType) ? CHANNEL_TABS[tabType].label : tabType;
}

export function getTabMediaType(tabType: string): string | undefined {
  return isChannelTab(tabType) ? CHANNEL_TABS[tabType].mediaType : undefined;
}
