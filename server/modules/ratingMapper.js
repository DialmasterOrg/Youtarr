/**
 * Rating Mapper Module
 * Maps YouTube/yt-dlp content rating fields to normalized Plex/Kodi ratings
 */

/** Sentinel value for "Not Rated" */
const NOT_RATED = 'NR';

/**
 * MPAA rating mappings
 */
const MPAA_RATINGS = {
  mpaaG: 'G',
  mpaaPg: 'PG',
  mpaaPg13: 'PG-13',
  mpaaR: 'R',
  mpaaNc17: 'NC-17',
  mpaaUnrated: null,
};

/**
 * TV Parental Guidance ratings mappings
 */
const TVPG_RATINGS = {
  tvpgY: 'TV-Y',
  tvpgY7: 'TV-Y7',
  tvpgG: 'TV-G',
  tvpgPg: 'TV-PG',
  14: 'TV-14',
  tvpg14: 'TV-14',
  tvpgMa: 'TV-MA',
  tvpgUnrated: null,
};

// Create case-insensitive lookup maps to allow varied casing from yt-dlp
const MPAA_MAP = {};
Object.keys(MPAA_RATINGS).forEach((k) => {
  MPAA_MAP[k.toLowerCase()] = MPAA_RATINGS[k];
});

const TVPG_MAP = {};
Object.keys(TVPG_RATINGS).forEach((k) => {
  TVPG_MAP[k.toLowerCase()] = TVPG_RATINGS[k];
});

/**
 * Age limit to rating heuristics (fallback when no explicit rating available)
 * Format: { minAge: 'rating' }
 * Used when age_limit is the only rating indicator
 */
const AGE_LIMIT_HEURISTICS = {
  18: 'R',
  16: 'PG-13',
  13: 'TV-14',
  7: 'TV-PG',
};

/**
 * Normalize a single rating value
 * @param {string} key - Rating key (e.g., 'mpaaR', 'tvpg14')
 * @returns {string|null} - Normalized rating (e.g., 'R', 'TV-14') or null if unable to map
 */
function normalizeRating(key) {
  if (!key) return null;

  const keyStr = String(key).toLowerCase().trim();

  if (Object.prototype.hasOwnProperty.call(MPAA_MAP, keyStr)) {
    return MPAA_MAP[keyStr];
  }

  if (Object.prototype.hasOwnProperty.call(TVPG_MAP, keyStr)) {
    return TVPG_MAP[keyStr];
  }

  return null;
}

/**
 * Map from yt-dlp age_limit to a rating
 * @param {number} ageLimit - Age limit from yt-dlp (e.g., 18, 13, 7)
 * @returns {string|null} - Normalized rating or null
 */
function mapAgeLimit(ageLimit) {
  if (ageLimit === null || ageLimit === undefined) return null;

  const age = parseInt(ageLimit, 10);
  if (isNaN(age)) return null;

  const thresholds = Object.keys(AGE_LIMIT_HEURISTICS)
    .map(Number)
    .sort((a, b) => b - a);

  for (const threshold of thresholds) {
    if (age >= threshold) {
      return AGE_LIMIT_HEURISTICS[threshold];
    }
  }

  return null;
}

/**
 * Map content rating from YouTube/yt-dlp to normalized Plex/Kodi rating
 * Priority: MPAA > TVPG > YT rating > age_limit fallback
 *
 * @param {Object} contentRating - Content rating object from YouTube/yt-dlp
 * @param {number} ageLimit - Age limit from yt-dlp (fallback)
 * @param {string} priority - Rating priority order (default: 'mpaa,tvpg,ytrating,age')
 * @returns {Object} - { normalized_rating: string|null, source: string|null, raw: Object }
 */
function mapFromEntry(contentRating, ageLimit, priority = 'mpaa,tvpg,ytrating,age') {
  const result = {
    normalized_rating: null,
    source: null,
    raw: contentRating,
  };

  if (!contentRating && ageLimit == null) {
    return result;
  }

  const priorities = priority.toLowerCase().split(',').map((p) => p.trim());

  for (const priorityLevel of priorities) {
    if (priorityLevel === 'mpaa' && contentRating) {
      const mpaaKey = contentRating.mpaaRating || contentRating.mpaa_rating;
      if (mpaaKey) {
        const normalized = normalizeRating(mpaaKey);
        if (normalized) {
          result.normalized_rating = normalized;
          result.source = `youtube:${mpaaKey}`;
          return result;
        }
      }
    }

    if (priorityLevel === 'tvpg' && contentRating) {
      const tvpgKey = contentRating.tvpgRating || contentRating.tvpg_rating;
      if (tvpgKey) {
        const normalized = normalizeRating(tvpgKey);
        if (normalized) {
          result.normalized_rating = normalized;
          result.source = `youtube:${tvpgKey}`;
          return result;
        }
      }
    }

    if (priorityLevel === 'ytrating' && contentRating) {
      const ytKey = contentRating.ytRating || contentRating.yt_rating;
      if (ytKey && ytKey.toLowerCase().includes('agerestricted')) {
        result.normalized_rating = 'R';
        result.source = `youtube:${ytKey}`;
        return result;
      }
    }

    if (priorityLevel === 'age' && ageLimit != null) {
      const normalized = mapAgeLimit(ageLimit);
      if (normalized) {
        result.normalized_rating = normalized;
        result.source = `yt-dlp:age_limit=${ageLimit}`;
        return result;
      }
    }
  }

  return result;
}

/**
 * Determine the effective rating based on priority:
 * 1. Manual Override (if provided and valid)
 * 2. Channel Default (if configured)
 * 3. Playlist Default (soft fallback; only when the real channel has no default)
 * 4. Mapped Metadata (from yt-dlp)
 * 5. NR (null)
 *
 * @param {Object} jsonData - The full .info.json object from yt-dlp
 * @param {string} channelDefaultRating - Default rating from channel settings (e.g. 'TV-Y')
 * @param {string} manualOverrideRating - Manual override from download settings (e.g. 'G', 'NR', or null)
 * @param {string} playlistFallbackRating - Soft fallback rating from the source playlist (e.g. 'PG'); applied only when no channel default is set
 * @returns {Object} - { normalized_rating: string|null, rating_source: string|null }
 */
function determineEffectiveRating(jsonData, channelDefaultRating, manualOverrideRating, playlistFallbackRating = null) {
  // 1. Manual Override
  if (manualOverrideRating !== undefined && manualOverrideRating !== '') {
    // Explicit "NR" override is valid - collapses to null but still short-circuits lower tiers.
    const val = manualOverrideRating === NOT_RATED ? null : manualOverrideRating;
    return {
      normalized_rating: val,
      numeric_rating: mapToNumericRating(val),
      rating_source: 'Manual Override'
    };
  }

  // 2. Channel Default Setting
  if (channelDefaultRating && channelDefaultRating !== NOT_RATED) {
    return {
      normalized_rating: channelDefaultRating,
      numeric_rating: mapToNumericRating(channelDefaultRating),
      rating_source: 'Channel Default'
    };
  }

  // 3. Playlist Default (soft fallback; only when the real channel has no default)
  if (playlistFallbackRating && playlistFallbackRating !== NOT_RATED) {
    return {
      normalized_rating: playlistFallbackRating,
      numeric_rating: mapToNumericRating(playlistFallbackRating),
      rating_source: 'Playlist Default'
    };
  }

  // 4. Rating parsed from ytdlp/metadata
  const mapped = mapFromEntry(jsonData.content_rating, jsonData.age_limit);
  if (mapped.normalized_rating && mapped.normalized_rating !== NOT_RATED) {
    return {
      normalized_rating: mapped.normalized_rating,
      numeric_rating: mapToNumericRating(mapped.normalized_rating),
      rating_source: mapped.source
    };
  }

  // 5. Fallback: NR
  return {
    normalized_rating: null,
    numeric_rating: null,
    rating_source: null
  };
}

/**
 * Map normalized rating to numeric scale where 1 = G and G equivalents
 * @param {string|null} normalizedRating - Normalized rating (e.g., 'G', 'TV-PG', 'R')
 * @returns {number|null} - Numeric rating (1-4) or null for NR/unrated
 */
function mapToNumericRating(normalizedRating) {
  if (!normalizedRating) return null;

  // Level 1: G and G equivalents (kids/family content)
  const level1 = ['G', 'TV-Y', 'TV-G'];
  if (level1.includes(normalizedRating)) {
    return 1;
  }

  // Level 2: PG and PG equivalents (family with some caution)
  const level2 = ['PG', 'TV-PG'];
  if (level2.includes(normalizedRating)) {
    return 2;
  }

  // Level 3: PG-13 and PG-13 equivalents (teens)
  const level3 = ['PG-13', 'TV-14'];
  if (level3.includes(normalizedRating)) {
    return 3;
  }

  // Level 4: R and R equivalents (mature content)
  const level4 = ['R', 'TV-MA', 'NC-17'];
  if (level4.includes(normalizedRating)) {
    return 4;
  }

  return null;
}

/**
 * iTunEXTC format mapping for Plex MP4 embedding.
 * Maps normalized ratings to the pipe-separated format Plex reads from the iTunEXTC atom.
 */
const ITUNEXTC_MAP = {
  'G': 'mpaa|G|',
  'PG': 'mpaa|PG|',
  'PG-13': 'mpaa|PG-13|',
  'R': 'mpaa|R|',
  'NC-17': 'mpaa|NC-17|',
  'TV-Y': 'us-tv|TV-Y|',
  'TV-Y7': 'us-tv|TV-Y7|',
  'TV-G': 'us-tv|TV-G|',
  'TV-PG': 'us-tv|TV-PG|',
  'TV-14': 'us-tv|TV-14|',
  'TV-MA': 'us-tv|TV-MA|',
};

/**
 * Map a normalized rating to iTunEXTC format for Plex MP4 embedding.
 * @param {string|null} normalizedRating - Normalized rating (e.g., 'PG-13', 'TV-MA')
 * @returns {string|null} - iTunEXTC value (e.g., 'mpaa|PG-13|') or null if not mappable
 */
function mapToITunEXTC(normalizedRating) {
  if (!normalizedRating) return null;
  return ITUNEXTC_MAP[normalizedRating] || null;
}

/**
 * Sorted array of valid normalized rating strings (e.g., ['G', 'NC-17', 'PG', ...]),
 * cached at module level. Used by validateRating below.
 */
const VALID_NORMALIZED_RATINGS = (() => {
  const ratings = new Set();
  Object.values(MPAA_RATINGS).forEach(r => { if (r !== null) ratings.add(r); });
  Object.values(TVPG_RATINGS).forEach(r => { if (r !== null) ratings.add(r); });
  return Array.from(ratings).sort();
})();

/**
 * Canonical rating validator/normalizer. Single source of truth for every place
 * that accepts a user-supplied rating (channel default, bulk video update, manual
 * and playlist download overrides).
 *
 * null/undefined and the NR sentinel (case-insensitive) both normalize to null
 * ("no rating"). Other values are trimmed, upper-cased, and checked against the
 * valid set. Empty string is rejected (not treated as "no rating").
 *
 * @param {string|null|undefined} input - Raw rating value
 * @returns {{ valid: boolean, value: (string|null), error?: string }} - On success,
 *   `value` is the normalized rating (or null). On failure, `error` is a message.
 */
function validateRating(input) {
  if (input === null || input === undefined) {
    return { valid: true, value: null };
  }
  if (typeof input !== 'string') {
    return { valid: false, error: 'rating must be a string or null' };
  }
  const normalized = input.trim().toUpperCase();
  if (normalized === NOT_RATED) {
    return { valid: true, value: null };
  }
  if (!VALID_NORMALIZED_RATINGS.includes(normalized)) {
    return {
      valid: false,
      error: `Invalid rating. Valid values: ${VALID_NORMALIZED_RATINGS.join(', ')}, ${NOT_RATED}, or null`,
    };
  }
  return { valid: true, value: normalized };
}

module.exports = {
  normalizeRating,
  mapAgeLimit,
  mapFromEntry,
  determineEffectiveRating,
  mapToNumericRating,
  mapToITunEXTC,
  validateRating,
  NOT_RATED,
  MPAA_RATINGS,
  TVPG_RATINGS,
  AGE_LIMIT_HEURISTICS,
};
