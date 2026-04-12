/**
 * Shared tab-type constants and helpers used by channelModule and
 * channelSettingsModule. Both modules originally duplicated these
 * definitions; this module is the single source of truth.
 */

const TAB_TYPES = Object.freeze({
  VIDEOS: 'videos',
  SHORTS: 'shorts',
  LIVE: 'streams',
});

const MEDIA_TAB_TYPE_MAP = Object.freeze({
  videos: 'video',
  shorts: 'short',
  streams: 'livestream',
});

const VALID_TAB_TYPES = new Set(Object.values(TAB_TYPES));

/**
 * Parse a comma-separated tab CSV string into a trimmed, non-empty array.
 * @param {string|null|undefined} csv
 * @returns {string[]}
 */
function parseTabCsv(csv) {
  if (!csv) return [];
  return csv.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
}

module.exports = {
  TAB_TYPES,
  MEDIA_TAB_TYPE_MAP,
  VALID_TAB_TYPES,
  parseTabCsv,
};
