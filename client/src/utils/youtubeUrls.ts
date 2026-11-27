const YOUTUBE_BASE_URL = 'https://www.youtube.com';

export function youtubeVideoUrl(youtubeId: string): string {
  return `${YOUTUBE_BASE_URL}/watch?v=${encodeURIComponent(youtubeId)}`;
}

export function youtubeChannelUrl(channelId: string): string {
  return `${YOUTUBE_BASE_URL}/channel/${encodeURIComponent(channelId)}`;
}

export function youtubePlaylistUrl(playlistId: string): string {
  return `${YOUTUBE_BASE_URL}/playlist?list=${encodeURIComponent(playlistId)}`;
}
