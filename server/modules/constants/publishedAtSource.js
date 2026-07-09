// Provenance of a channelvideo's publishedAt. Persisted to the
// channelvideos.published_at_source column; mirrored by the frontend union in
// client/src/types/ChannelVideo.ts. NULL is a valid legacy value (treated like
// 'approximate') and is intentionally not a member here.
const PUBLISHED_AT_SOURCE = Object.freeze({
  EXACT: 'exact', // from a download's .info.json (authoritative)
  APPROXIMATE: 'approximate', // yt-dlp flat-playlist date
  ESTIMATED: 'estimated', // ordering-only placeholder, never displayed
});

module.exports = { PUBLISHED_AT_SOURCE };
