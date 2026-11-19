/**
 * Path/filename sanitization that exactly replicates yt-dlp's --windows-filenames behavior
 *
 * This is a direct port of yt-dlp's sanitize_path() and _sanitize_path_parts() functions
 * from yt_dlp/utils/_utils.py
 *
 * Reference: https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/utils/_utils.py
 */

/**
 * Sanitize individual path parts for Windows compatibility
 * Direct port of yt-dlp's _sanitize_path_parts()
 *
 * @param {string[]} parts - Array of path segments
 * @returns {string[]} - Sanitized path segments
 */
function sanitizePathParts(parts) {
  const sanitizedParts = [];

  for (const part of parts) {
    // Skip empty parts and single dots
    if (!part || part === '.') {
      continue;
    }

    // Handle parent directory references
    if (part === '..') {
      if (sanitizedParts.length > 0 && sanitizedParts[sanitizedParts.length - 1] !== '..') {
        sanitizedParts.pop();
      } else {
        sanitizedParts.push('..');
      }
      continue;
    }

    // Replace invalid segments with `#`
    // - trailing dots and spaces (`asdf...` => `asdf..#`)
    // - invalid chars (`<>` => `##`)
    // Regex: [/<>:"\|\\?\*] matches Windows-forbidden characters
    //        [\s.]$ matches trailing whitespace or dots
    const sanitizedPart = part.replace(/[/<>:"|\\?*]|[\s.]$/g, '#');
    sanitizedParts.push(sanitizedPart);
  }

  return sanitizedParts;
}

/**
 * Sanitize just a single filename/folder name component (not a full path)
 * This applies the same character replacement rules but doesn't handle path separators
 *
 * Uses the exact same regex as yt-dlp's _sanitize_path_parts():
 *   re.sub(r'[/<>:"\|\\?\*]|[\s.]$', '#', part)
 *
 * Note: [\s.]$ only replaces a SINGLE trailing space/dot, not all of them.
 * Example: "asdf..." => "asdf..#" (only last dot replaced)
 *
 * @param {string} name - The filename or folder name to sanitize
 * @returns {string} - The sanitized name
 */
function sanitizeNameLikeYtDlp(name) {
  if (!name || typeof name !== 'string') {
    return '_';
  }

  // Use the exact same regex as yt-dlp's _sanitize_path_parts
  // [/<>:"|\\?*] matches Windows-forbidden characters
  // [\s.]$ matches a single trailing whitespace or dot
  const sanitized = name.replace(/[/<>:"|\\?*]|[\s.]$/g, '#');

  return sanitized || '_';
}

const SUBSTITUTE_MARKER = '\0';
const FULLWIDTH_OFFSET = 0xfee0;
const FULLWIDTH_CHARS = '"*:<>?|';
const SLASH_REPLACEMENTS = { '/': '⧸', '\\': '⧹' };
const DIGIT_COLON_RUN_PATTERN = /[0-9]+(?::[0-9]+)+/g;
const REPEATED_SUBSTITUTE_PATTERN = /(\0.)(?:(?=\1)..)+/gsu;
const EDGE_SUBSTITUTE_PATTERN = /^\0.(?:\0.|[ _-])*|(?:\0.|[ _-])*\0.$/gsu;

/**
 * Port of yt-dlp's per-character replacement in sanitize_filename() for its
 * default mode (restricted=False, is_id=NO_DEFAULT), the mode used for every
 * output template field such as %(title)s.
 */
function replaceInsaneChar(char) {
  if (char === '\n') {
    return `${SUBSTITUTE_MARKER} `;
  }
  if (SLASH_REPLACEMENTS[char]) {
    return SLASH_REPLACEMENTS[char];
  }
  if (FULLWIDTH_CHARS.includes(char)) {
    return String.fromCodePoint(char.codePointAt(0) + FULLWIDTH_OFFSET);
  }
  const code = char.codePointAt(0);
  if (code < 32 || code === 127) {
    return '';
  }
  return char;
}

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * Cut text to at most maxBytes of UTF-8 between whole characters as a reader
 * sees them (grapheme clusters), so an emoji sequence, flag or accented letter
 * is never split, and drop whitespace the cut leaves at the end.
 */
function truncateUtf8(text, maxBytes) {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) {
    return text;
  }
  let bytes = 0;
  let truncated = '';
  for (const { segment } of graphemeSegmenter.segment(text)) {
    const size = Buffer.byteLength(segment, 'utf8');
    if (bytes + size > maxBytes) {
      break;
    }
    truncated += segment;
    bytes += size;
  }
  return truncated.trimEnd() || '_';
}

/**
 * Sanitize text for use inside a filename the way yt-dlp sanitizes an output
 * template field (port of sanitize_filename() in its default mode): digit runs
 * joined by colons become underscores, "*:<>?| become their fullwidth forms,
 * / and \ become U+29F8 and U+29F9, newlines become spaces, and other control
 * characters are dropped. With maxBytes, the result is then cut to that many
 * UTF-8 bytes at a character boundary. yt-dlp's %(title).64B cuts before it
 * sanitizes and can exceed the limit; this cuts after, so it never does.
 *
 * The --windows-filenames step (sanitizeNameLikeYtDlp) only changes a trailing
 * dot or space of a whole path segment; apply it when the result ends one.
 *
 * @param {string} name - Text to sanitize (e.g. a video title)
 * @param {Object} [options]
 * @param {number} [options.maxBytes] - Maximum UTF-8 length of the result
 * @returns {string} - '' for empty input, otherwise a non-empty string
 */
function sanitizeFilenameLikeYtDlp(name, { maxBytes } = {}) {
  if (typeof name !== 'string' || name === '') {
    return '';
  }
  const withoutColonRuns = name.replace(DIGIT_COLON_RUN_PATTERN, (run) => run.replace(/:/g, '_'));
  const sanitized = Array.from(withoutColonRuns, replaceInsaneChar).join('')
    .replace(REPEATED_SUBSTITUTE_PATTERN, '$1')
    .replace(EDGE_SUBSTITUTE_PATTERN, '')
    .replace(/\0/g, '') || '_';
  return Number.isInteger(maxBytes) && maxBytes > 0 ? truncateUtf8(sanitized, maxBytes) : sanitized;
}

module.exports = {
  sanitizeNameLikeYtDlp,
  sanitizePathParts,
  sanitizeFilenameLikeYtDlp
};
