/**
 * The configured subtitle language list ("en,es", from Settings > Core) as
 * yt-dlp and the post-download subtitle pruning both read it.
 */

const DEFAULT_SUBTITLE_LANGUAGE = 'en';
// yt-dlp's "every subtitle track" alias, recognized only as this exact string;
// expanding it would turn it into a regex that matches no track at all.
const YTDLP_ALL_SUBTITLES_ALIAS = 'all';
// A bare ISO 639 code as saved by the subtitle language selector ("en", "fil").
const BARE_LANGUAGE_CODE = /^[a-z]{2,3}$/i;
// A language code with optional subtags ("en", "en-orig", "pt-BR", "zh-Hans"),
// as opposed to a yt-dlp alias, exclusion ("-live_chat") or regex ("en.*").
const PLAIN_LANGUAGE_CODE = /^[a-z]{2,3}(-[a-z0-9]+)*$/i;

/**
 * Split the configured comma-separated list into trimmed entries.
 * @param {string|null} subtitleLanguage - The saved config value
 * @returns {string[]} - Entries, or English when nothing usable is configured
 */
function parseSubtitleLanguages(subtitleLanguage) {
  const entries = (subtitleLanguage || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries.length > 0 ? entries : [DEFAULT_SUBTITLE_LANGUAGE];
}

/**
 * True for a bare language code, which Youtarr expands to also match its
 * regional and script variants. Anything else (en-orig, a hand-edited pt-BR,
 * the "all" alias, an exclusion, a regex) is handed to yt-dlp as written.
 * @param {string} entry - One parsed entry
 * @returns {boolean}
 */
function isExpandableLanguageCode(entry) {
  return entry !== YTDLP_ALL_SUBTITLES_ALIAS && BARE_LANGUAGE_CODE.test(entry);
}

/**
 * True for an entry that names one track code, bare or with subtags. The
 * post-download pruning only runs when every configured entry is one of
 * these, because an alias, exclusion or regex can request tracks the pruning
 * rules would otherwise drop.
 * @param {string} entry - One parsed entry
 * @returns {boolean}
 */
function isPlainLanguageCode(entry) {
  return entry !== YTDLP_ALL_SUBTITLES_ALIAS && PLAIN_LANGUAGE_CODE.test(entry);
}

module.exports = {
  DEFAULT_SUBTITLE_LANGUAGE,
  parseSubtitleLanguages,
  isExpandableLanguageCode,
  isPlainLanguageCode,
};
