// Limits for the download feed settings. configModule corrects hand-edited values
// on load, because the client saves the full config and one bad stored value
// would otherwise block every Settings save.
const DEFAULT_ITEM_LIMIT = 50;
const MIN_ITEM_LIMIT = 10;
const MAX_ITEM_LIMIT = 200;
const MEDIA_TYPES = ['video', 'short', 'livestream'];

function normalizeItemLimit(value) {
  const limit = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(limit)) return DEFAULT_ITEM_LIMIT;
  return Math.min(Math.max(limit, MIN_ITEM_LIMIT), MAX_ITEM_LIMIT);
}

function normalizeMediaTypes(value) {
  const known = Array.isArray(value) ? MEDIA_TYPES.filter((type) => value.includes(type)) : [];
  return known.length > 0 ? known : [...MEDIA_TYPES];
}

function getItemLimitError(value) {
  if (Number.isInteger(value) && value >= MIN_ITEM_LIMIT && value <= MAX_ITEM_LIMIT) return null;
  return `Feed item limit must be a whole number from ${MIN_ITEM_LIMIT} to ${MAX_ITEM_LIMIT}`;
}

function getMediaTypesError(value) {
  if (!Array.isArray(value) || value.some((type) => !MEDIA_TYPES.includes(type))) {
    return 'Feed media types must be video, short or livestream';
  }
  return value.length > 0 ? null : 'Choose at least one video type for the feed';
}

module.exports = {
  DEFAULT_ITEM_LIMIT,
  MEDIA_TYPES,
  normalizeItemLimit,
  normalizeMediaTypes,
  getItemLimitError,
  getMediaTypesError,
};
