const logger = require('../../logger');

// Cap on the serialized owner-channel map passed to the post-processor via an
// environment variable. Linux limits a single env var to ~128KB (MAX_ARG_STRLEN);
// stay well under it. A typical entry is ~40 bytes, so this covers thousands of videos.
const OWNER_CHANNEL_MAP_MAX_BYTES = 64 * 1024;

// The YOUTARR_* variables are read by the post-processor script to route
// files and set ratings.
function buildYtdlpEnv({ jobId, tempBasePath, postProcessDirectives, baseEnv = process.env }) {
  const {
    subfolderOverride = null,
    subfolderFallback = null,
    ratingOverride = undefined,
    ratingFallback = null,
    skipVideoFolder = false,
    ownerChannelId = null,
    ownerChannelMap = null,
  } = postProcessDirectives || {};

  const env = {
    ...baseEnv,
    YOUTARR_JOB_ID: jobId,
    TMPDIR: tempBasePath,
  };

  if (subfolderOverride !== null && subfolderOverride !== undefined) {
    env.YOUTARR_SUBFOLDER_OVERRIDE = subfolderOverride;
  }

  // Soft fallback: post-processor uses it only when the video's real channel is untracked
  if (subfolderFallback !== null && subfolderFallback !== undefined) {
    env.YOUTARR_SUBFOLDER_FALLBACK = subfolderFallback;
  }

  if (skipVideoFolder) {
    env.YOUTARR_SKIP_VIDEO_FOLDER = 'true';
  }

  // null is the explicit "clear rating" sentinel -> 'NR'
  if (ratingOverride !== undefined) {
    env.YOUTARR_OVERRIDE_RATING = ratingOverride === null ? 'NR' : String(ratingOverride);
  }

  // Soft fallback: post-processor uses it only when the real channel has no default rating
  if (ratingFallback !== null && ratingFallback !== undefined) {
    env.YOUTARR_RATING_FALLBACK = String(ratingFallback);
  }

  // The post-processor prefers it over the video's own channel_id when resolving the owner
  if (ownerChannelId !== null && ownerChannelId !== undefined && String(ownerChannelId).trim() !== '') {
    env.YOUTARR_OWNER_CHANNEL_ID = String(ownerChannelId).trim();
  }

  // The post-processor looks up its own youtube_id, so a superset map is fine
  if (ownerChannelMap && typeof ownerChannelMap === 'object' && Object.keys(ownerChannelMap).length > 0) {
    try {
      const serialized = JSON.stringify(ownerChannelMap);
      if (serialized.length <= OWNER_CHANNEL_MAP_MAX_BYTES) {
        env.YOUTARR_OWNER_CHANNEL_MAP = serialized;
      } else {
        logger.warn({ bytes: serialized.length }, 'owner channel map exceeds env size cap; per-video owner resolution skipped');
      }
    } catch (err) {
      logger.warn({ err }, 'could not serialize owner channel map');
    }
  }

  return env;
}

module.exports = { buildYtdlpEnv, OWNER_CHANNEL_MAP_MAX_BYTES };
