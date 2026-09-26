const BOOLEAN_KEYS = ['auto_download', 'sync_to_plex', 'sync_to_jellyfin', 'sync_to_emby', 'public_on_servers'];
const VALID_SORT_ORDERS = ['default', 'reversed'];
// Settings whose validators call string methods; anything else is rejected before they run.
const STRING_KEYS = ['default_sub_folder', 'video_quality', 'audio_format', 'title_filter_regex'];

/**
 * Builds the validator for the settings sent when subscribing to a playlist.
 *
 * The returned function takes the raw `settings` body value and returns
 * { ok: true, value } or { ok: false, error }. Keys that are not playlist
 * settings (enabled, playlist_id, following state, ...) are dropped, so the
 * subscribe request can never write them. Each value is checked with the same
 * validators the channel settings use; the rating is normalized (NR -> null).
 */
function createSubscribeSettingsValidator({ channelSettingsModule, ratingMapper }) {
  const checks = {
    default_sub_folder: (value) => {
      if (value === null || value === '') return { valid: true };
      const valid = channelSettingsModule.validateSubFolder(value).valid;
      return valid ? { valid: true } : { valid: false, error: 'Invalid default_sub_folder' };
    },
    video_quality: (value) => channelSettingsModule.validateVideoQuality(value),
    audio_format: (value) => channelSettingsModule.validateAudioFormat(value),
    title_filter_regex: (value) => channelSettingsModule.validateTitleRegex(value),
    sort_order: (value) => (VALID_SORT_ORDERS.includes(value)
      ? { valid: true }
      : { valid: false, error: 'Invalid sort_order; expected default or reversed' }),
  };

  return function validateSubscribeSettings(input) {
    if (input === undefined || input === null) return { ok: true, value: {} };
    if (typeof input !== 'object' || Array.isArray(input)) {
      return { ok: false, error: 'settings must be an object' };
    }

    const nonString = STRING_KEYS.find((key) => input[key] != null && typeof input[key] !== 'string');
    if (nonString) return { ok: false, error: `${nonString} must be a string or null` };

    const out = {};
    for (const key of BOOLEAN_KEYS) {
      if (!(key in input)) continue;
      if (typeof input[key] !== 'boolean') return { ok: false, error: `${key} must be a boolean` };
      out[key] = input[key];
    }

    for (const [key, check] of Object.entries(checks)) {
      if (!(key in input)) continue;
      const result = check(input[key]);
      if (!result.valid) return { ok: false, error: result.error };
      out[key] = input[key];
    }

    if ('min_duration' in input || 'max_duration' in input) {
      const min = input.min_duration ?? null;
      const max = input.max_duration ?? null;
      const result = channelSettingsModule.validateDurationSettings(min, max);
      if (!result.valid) return { ok: false, error: result.error };
      if ('min_duration' in input) out.min_duration = min;
      if ('max_duration' in input) out.max_duration = max;
    }

    if ('default_rating' in input) {
      const result = ratingMapper.validateRating(input.default_rating);
      if (!result.valid) return { ok: false, error: result.error };
      out.default_rating = result.value;
    }

    return { ok: true, value: out };
  };
}

module.exports = { createSubscribeSettingsValidator };
