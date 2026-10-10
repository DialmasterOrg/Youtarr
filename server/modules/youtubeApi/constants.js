const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_API_TIMEOUT_MS = 15000;

// YouTube Data API quotas reset at midnight Pacific time.
const QUOTA_RESET_TIMEZONE = 'America/Los_Angeles';

const ENDPOINTS = {
  videos: '/videos',
  channels: '/channels',
  playlistItems: '/playlistItems',
  playlists: '/playlists',
  search: '/search',
};

// Max IDs per batched videos.list call.
const VIDEOS_LIST_BATCH_SIZE = 50;

// Max IDs per batched playlists.list call.
const PLAYLISTS_LIST_BATCH_SIZE = 50;

// Per-tab auto-generated playlist prefixes. UU is all uploads combined;
// UULF/UUSH/UULV are the same content partitioned by media type and correspond
// exactly to the Videos/Shorts/Live tabs on the channel page. Undocumented by
// Google but stable for years. Members-only videos are in separate UUM*
// playlists and are not counted here.
const TAB_PLAYLIST_PREFIX = Object.freeze({
  videos: 'UULF',
  shorts: 'UUSH',
  streams: 'UULV',
});

// YouTube channel IDs are always exactly 24 chars: "UC" + 22 base64url-ish chars.
// Validating the full shape up-front catches typos/corrupt data before we construct
// a bogus playlist ID and hit the API for nothing.
const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;

module.exports = {
  YOUTUBE_API_BASE_URL,
  YOUTUBE_API_TIMEOUT_MS,
  QUOTA_RESET_TIMEZONE,
  ENDPOINTS,
  VIDEOS_LIST_BATCH_SIZE,
  PLAYLISTS_LIST_BATCH_SIZE,
  TAB_PLAYLIST_PREFIX,
  CHANNEL_ID_PATTERN,
};
