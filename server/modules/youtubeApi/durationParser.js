const ISO_8601_DURATION_REGEX = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;

function parseIso8601Duration(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  const match = value.match(ISO_8601_DURATION_REGEX);
  if (!match) return null;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

module.exports = { parseIso8601Duration };
