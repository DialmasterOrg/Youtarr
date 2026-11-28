const { DOWNLOAD_RESOLUTIONS, AUDIO_FORMATS } = require('../modules/constants/downloadOptions');

/**
 * Builds a download override-settings validator for route input. Shared by
 * the playlist download and channel download-all routes.
 *
 * The returned function takes the raw overrideSettings body value and returns
 * { ok: true, value } or { ok: false }. value is undefined when input is
 * absent. Unknown keys are ignored. Rating is validated and normalized via
 * ratingMapper (NR/null -> null).
 */
function createOverrideSettingsValidator({ channelSettingsModule, ratingMapper }) {
  return function validateOverrideSettings(input) {
    if (input === undefined) return { ok: true, value: undefined };
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return { ok: false };
    const out = {};
    if ('resolution' in input) {
      if (!DOWNLOAD_RESOLUTIONS.includes(String(input.resolution))) return { ok: false };
      out.resolution = String(input.resolution);
    }
    if ('allowRedownload' in input) {
      if (typeof input.allowRedownload !== 'boolean') return { ok: false };
      out.allowRedownload = input.allowRedownload;
    }
    if ('skipVideoFolder' in input) {
      if (typeof input.skipVideoFolder !== 'boolean') return { ok: false };
      out.skipVideoFolder = input.skipVideoFolder;
    }
    if ('protect' in input) {
      if (typeof input.protect !== 'boolean') return { ok: false };
      out.protect = input.protect;
    }
    if ('subfolder' in input) {
      if (input.subfolder !== null) {
        if (typeof input.subfolder !== 'string') return { ok: false };
        if (!channelSettingsModule.validateSubFolder(input.subfolder).valid) return { ok: false };
      }
      out.subfolder = input.subfolder;
    }
    if ('audioFormat' in input) {
      if (input.audioFormat !== null && !AUDIO_FORMATS.includes(input.audioFormat)) return { ok: false };
      out.audioFormat = input.audioFormat;
    }
    if ('rating' in input) {
      const ratingResult = ratingMapper.validateRating(input.rating);
      if (!ratingResult.valid) return { ok: false };
      out.rating = ratingResult.value;
    }
    return { ok: true, value: out };
  };
}

module.exports = { createOverrideSettingsValidator };
