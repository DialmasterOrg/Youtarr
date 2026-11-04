// yt-dlp's info.json carries fields Youtarr never reads. `automatic_captions`
// alone is most of each file: YouTube lists every machine-translation target
// for every uploaded subtitle language (28 uploaded languages came to 4,528
// entries and 13.6 MB of a 15 MB file), so the cached copy leaves it out.
// `subtitles` stays (the subtitle sidecar pruner reads it), as does `formats`
// (the available-resolutions list).
const UNUSED_INFO_JSON_FIELDS = ['automatic_captions'];

/**
 * Drops the fields Youtarr never reads, in place, and returns the same object.
 * @param {object|null|undefined} info - Parsed yt-dlp info.json
 * @returns {object|null|undefined} The same object
 */
function slimInfoJson(info) {
  if (!info || typeof info !== 'object') return info;
  for (const field of UNUSED_INFO_JSON_FIELDS) delete info[field];
  return info;
}

module.exports = { slimInfoJson };
