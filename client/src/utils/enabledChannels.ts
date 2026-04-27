import { EnabledChannel } from '../types/VideoData';

export function getEnabledChannelId(
  channelName: string,
  videoChannelId: string | null | undefined,
  enabledChannels: EnabledChannel[]
): string | null {
  if (videoChannelId) {
    const match = enabledChannels.find((ch) => ch.channel_id === videoChannelId);
    if (match) return match.channel_id;
  }
  const match = enabledChannels.find((ch) => ch.uploader === channelName);
  return match ? match.channel_id : null;
}
