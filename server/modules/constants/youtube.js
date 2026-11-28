// YouTube id and URL formats, kept in one place.

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const buildWatchUrl = (videoId) => `https://www.youtube.com/watch?v=${videoId}`;

const buildChannelUrl = (channelId) => `https://www.youtube.com/channel/${channelId}`;

// size is one of YouTube's thumbnail names, such as hqdefault or mqdefault.
const buildVideoThumbnailUrl = (videoId, size = 'hqdefault') =>
  `https://i.ytimg.com/vi/${videoId}/${size}.jpg`;

module.exports = { VIDEO_ID_PATTERN, buildWatchUrl, buildChannelUrl, buildVideoThumbnailUrl };
