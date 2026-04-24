const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_API_TIMEOUT_MS = 15000;

// YouTube Data API quotas reset at midnight Pacific time.
const QUOTA_RESET_TIMEZONE = 'America/Los_Angeles';

const ENDPOINTS = {
  videos: '/videos',
  channels: '/channels',
  playlistItems: '/playlistItems',
  search: '/search',
};

// Max IDs per batched videos.list call.
const VIDEOS_LIST_BATCH_SIZE = 50;

// Max items per page for playlistItems.list.
const PLAYLIST_ITEMS_PAGE_SIZE = 50;

module.exports = {
  YOUTUBE_API_BASE_URL,
  YOUTUBE_API_TIMEOUT_MS,
  QUOTA_RESET_TIMEZONE,
  ENDPOINTS,
  VIDEOS_LIST_BATCH_SIZE,
  PLAYLIST_ITEMS_PAGE_SIZE,
};
