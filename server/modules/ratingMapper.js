/**
 * Rating Mapper Module
 * Maps YouTube/yt-dlp content rating fields to normalized Plex/Kodi ratings
 */

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
 * 3. Mapped Metadata (from yt-dlp)
 * 4. NR (null)
 * 
 * @param {Object} jsonData - The full .info.json object from yt-dlp
 * @param {string} channelDefaultRating - Default rating from channel settings (e.g. 'TV-Y')
 * @param {string} manualOverrideRating - Manual override from download settings (e.g. 'G', 'NR', or null)
 * @returns {Object} - { normalized_rating: string|null, rating_source: string|null }
 */
function determineEffectiveRating(jsonData, channelDefaultRating, manualOverrideRating) {
  // 1. Manual Override
  if (manualOverrideRating !== undefined && manualOverrideRating !== '') {
    // If user explicitly chose "NR" (represented as "NR" string or specific null sentinel), treat as null.
    // However, since it is an *override*, it should be treated as the effective rating even if null.
    const val = manualOverrideRating === 'NR' ? null : manualOverrideRating;
    return {
      normalized_rating: val,
      numeric_rating: mapToNumericRating(val),
      rating_source: 'Manual Override'
    };
  }

  // 2. Channel Default Setting
  if (channelDefaultRating && channelDefaultRating !== 'NR') {
    return {
      normalized_rating: channelDefaultRating,
      numeric_rating: mapToNumericRating(channelDefaultRating),
      rating_source: 'Channel Default'
    };
  }

  // 3. Rating parsed from ytdlp/metadata
  const mapped = mapFromEntry(jsonData.content_rating, jsonData.age_limit);
  if (mapped.normalized_rating && mapped.normalized_rating !== 'NR') {
    return {
      normalized_rating: mapped.normalized_rating,
      numeric_rating: mapToNumericRating(mapped.normalized_rating),
      rating_source: mapped.source
    };
  }

  // 4. Fallback: NR
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

module.exports = {
  normalizeRating,
  mapAgeLimit,
  mapFromEntry,
  determineEffectiveRating,
  mapToNumericRating,
  MPAA_RATINGS,
  TVPG_RATINGS,
  AGE_LIMIT_HEURISTICS,
};
