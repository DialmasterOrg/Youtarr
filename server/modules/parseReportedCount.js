/**
 * A count reported by YouTube or yt-dlp, or null when it is not a usable
 * non-negative integer. Anything other than a number or a non-blank string is
 * rejected before conversion, because Number(null), Number(''), and
 * Number([]) are all 0 and would pass as an empty playlist.
 * @param {unknown} value
 * @returns {number|null}
 */
function parseReportedCount(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

module.exports = parseReportedCount;
