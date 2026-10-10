// Hides secrets in log text before it leaves Youtarr through "Download logs".
// Pino's redaction only removes a few top-level keys; tokens still reach the
// log inside logged request errors (Plex URLs and params, Emby headers) and
// the logged yt-dlp arguments (proxy credentials).
const REDACTED = '[REDACTED]';
const SECRET_CONFIG_KEYS = ['plexApiKey', 'plexPlaylistToken', 'jellyfinApiKey', 'embyApiKey', 'youtubeApiKey'];
// Shorter values would match ordinary text; real keys and tokens are longer.
const MIN_SECRET_LENGTH = 8;

const SECRET_PATTERNS = [
  [/([?&](?:X-Plex-Token|api_key)=)[^&\s"']+/gi, `$1${REDACTED}`],
  [/("X-(?:Plex|Emby)-Token"\s*:\s*")[^"]*/gi, `$1${REDACTED}`],
  // user:password@ in URLs such as a yt-dlp --proxy value
  [/(\w+:\/\/)[^/\s:@"']+:[^/\s@"']+@/g, `$1${REDACTED}@`],
];

// Apprise URLs embed webhook tokens, bot tokens and SMTP passwords, and the
// Apprise sender logs the CLI's stderr, which can echo a URL.
function notificationUrls(config) {
  const entries = Array.isArray(config.appriseUrls) ? config.appriseUrls : [];
  return entries.map((entry) => (typeof entry === 'string' ? entry : entry?.url));
}

function createLogScrubber(config) {
  const secrets = [...SECRET_CONFIG_KEYS.map((key) => config[key]), ...notificationUrls(config)]
    .filter((value) => typeof value === 'string' && value.length >= MIN_SECRET_LENGTH)
    // Longest first, so a secret containing another is replaced whole.
    .sort((a, b) => b.length - a.length);

  return function scrubLine(line) {
    let scrubbed = line;
    for (const secret of secrets) {
      scrubbed = scrubbed.split(secret).join(REDACTED);
    }
    for (const [pattern, replacement] of SECRET_PATTERNS) {
      scrubbed = scrubbed.replace(pattern, replacement);
    }
    return scrubbed;
  };
}

module.exports = { createLogScrubber };
