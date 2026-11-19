const ratingMapper = require('../ratingMapper');
const { CatalogError } = require('./externalPagination');

const MEDIA_TYPES = ['video', 'short', 'livestream'];
const RATING_LABELS = [
  'G', 'TV-Y', 'TV-Y7', 'TV-G', 'PG', 'TV-PG',
  'PG-13', 'TV-14', 'R', 'TV-MA', 'NC-17',
];
// ratingMapper has no numeric level for TV-Y7 (NFO output falls back to the
// text rating), but key policies need one so TV-Y7 videos are neither hidden
// from nor treated as unrated by every key. Place it with PG/TV-PG.
const EXTERNAL_RATING_LEVEL_OVERRIDES = { 'TV-Y7': 2 };

function ratingLevel(rating) {
  return EXTERNAL_RATING_LEVEL_OVERRIDES[rating] ?? ratingMapper.mapToNumericRating(rating);
}

function normalizeExternalPolicy(policy, ErrorType = Error) {
  const maxRatingLevel = policy?.maxRatingLevel;
  const allowUnrated = policy?.allowUnrated;
  const allowedMediaTypes = policy?.allowedMediaTypes;
  if (!Number.isInteger(maxRatingLevel) || maxRatingLevel < 1 || maxRatingLevel > 4 ||
      typeof allowUnrated !== 'boolean' || !Array.isArray(allowedMediaTypes) ||
      allowedMediaTypes.length === 0 ||
      allowedMediaTypes.some((type) => !MEDIA_TYPES.includes(type))) {
    throw new ErrorType('Invalid external API key policy', 401);
  }
  return {
    maxRatingLevel,
    allowUnrated,
    allowedMediaTypes: [...new Set(allowedMediaTypes)],
  };
}

function normalizePolicy(policy) {
  return normalizeExternalPolicy(policy, CatalogError);
}

function effectiveRating(videoRating, channelDefaultRating) {
  return videoRating == null || videoRating === ''
    ? (channelDefaultRating == null || channelDefaultRating === '' ? null : channelDefaultRating)
    : videoRating;
}

function isRatingEligible(policy, videoRating, channelDefaultRating) {
  const rating = effectiveRating(videoRating, channelDefaultRating);
  const numericRating = ratingLevel(rating);
  if (numericRating === null) return policy.allowUnrated;
  return numericRating <= policy.maxRatingLevel;
}

function isMediaTypeEligible(policy, mediaType) {
  return MEDIA_TYPES.includes(mediaType) && policy.allowedMediaTypes.includes(mediaType);
}

function ratingPolicy(policy) {
  const recognizedRatings = RATING_LABELS.filter(
    (rating) => ratingLevel(rating) !== null
  );
  return {
    recognizedRatings,
    allowedRatings: recognizedRatings.filter(
      (rating) => ratingLevel(rating) <= policy.maxRatingLevel
    ),
  };
}

module.exports = {
  MEDIA_TYPES,
  RATING_LABELS,
  normalizeExternalPolicy,
  normalizePolicy,
  effectiveRating,
  isRatingEligible,
  isMediaTypeEligible,
  ratingPolicy,
};
