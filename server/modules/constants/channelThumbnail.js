// Longest side, in pixels, of a cached channel thumbnail. Avatar sources run
// from under 200 px to over 4000 px, so a fixed cap replaces a percentage.
const CHANNEL_THUMBNAIL_MAX_SIDE_PX = 512;

// ffmpeg -vf value, passed as one argument (never through a shell): fits the
// image inside a square of the cap, keeps its aspect ratio, never upscales.
const CHANNEL_THUMBNAIL_SCALE_FILTER =
  `scale='min(${CHANNEL_THUMBNAIL_MAX_SIDE_PX},iw)':'min(${CHANNEL_THUMBNAIL_MAX_SIDE_PX},ih)':force_original_aspect_ratio=decrease`;

module.exports = { CHANNEL_THUMBNAIL_MAX_SIDE_PX, CHANNEL_THUMBNAIL_SCALE_FILTER };
