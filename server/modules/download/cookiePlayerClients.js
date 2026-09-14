// Player clients yt-dlp should use when we pass cookies.
//
// With logged-in cookies, yt-dlp's default clients all fail for accounts in
// YouTube's SABR-only experiment: the web clients return formats with no URL
// and the TV client is UNPLAYABLE, so only the 360p itag 18 is left. mweb
// still gives full DASH for Premium sessions (free ones need a PO token, so
// yt-dlp skips those), and web_safari gives the HLS combined streams, which
// never need a token. default stays first so working accounts pick the same
// format they do now.
//
// yt-dlp doesn't merge repeated --extractor-args for the same extractor; the
// last youtube: token wins outright. Custom args go last, so we fold our
// player_client into the user's youtube: token instead of adding our own.

const COOKIE_PLAYER_CLIENTS = 'default,mweb,web_safari';
const PLAYER_CLIENT_ARG = `player_client=${COOKIE_PLAYER_CLIENTS}`;
const MANAGED_TOKEN = `youtube:${PLAYER_CLIENT_ARG}`;

const EXTRACTOR_ARGS_FLAG = '--extractor-args';
const YOUTUBE_KEY_PATTERN = /^youtube:/i;

// yt-dlp lowercases extractor-arg keys and maps '-' to '_'.
function normalizeArgKey(key) {
  return key.trim().toLowerCase().replace(/-/g, '_');
}

function hasPlayerClient(youtubeArgs) {
  return youtubeArgs
    .split(';')
    .some((arg) => normalizeArgKey(arg.split('=', 1)[0]) === 'player_client');
}

function appendPlayerClient(youtubeArgs) {
  const trimmed = youtubeArgs.trim();
  if (!trimmed) return PLAYER_CLIENT_ARG;
  return trimmed.endsWith(';') ? `${trimmed}${PLAYER_CLIENT_ARG}` : `${trimmed};${PLAYER_CLIENT_ARG}`;
}

// Index of the last youtube: token (yt-dlp only keeps the last one) and
// whether the value is attached with '='.
function findYoutubeToken(tokens) {
  let found = null;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === EXTRACTOR_ARGS_FLAG) {
      const value = tokens[i + 1];
      if (typeof value === 'string' && YOUTUBE_KEY_PATTERN.test(value)) {
        found = { index: i + 1, attached: false };
      }
    } else if (token.startsWith(`${EXTRACTOR_ARGS_FLAG}=`)) {
      const value = token.slice(EXTRACTOR_ARGS_FLAG.length + 1);
      if (YOUTUBE_KEY_PATTERN.test(value)) {
        found = { index: i, attached: true };
      }
    }
  }
  return found;
}

/**
 * Merge the managed cookie player clients into a custom-args token array.
 *
 * - No user `youtube:` token: managed token first, then the custom args.
 * - User `youtube:` token without player_client: fold ours into it.
 * - User `youtube:` token with player_client: user wins, nothing added.
 *
 * @param {string[]} customArgs
 * @returns {string[]}
 */
function mergeCookiePlayerClients(customArgs) {
  const tokens = [...customArgs];
  const found = findYoutubeToken(tokens);

  if (!found) {
    return [EXTRACTOR_ARGS_FLAG, MANAGED_TOKEN, ...tokens];
  }

  const prefixLength = found.attached ? EXTRACTOR_ARGS_FLAG.length + 1 : 0;
  const prefix = tokens[found.index].slice(0, prefixLength);
  const value = tokens[found.index].slice(prefixLength);
  const key = value.slice(0, value.indexOf(':') + 1);
  const youtubeArgs = value.slice(key.length);

  if (hasPlayerClient(youtubeArgs)) {
    return tokens;
  }

  tokens[found.index] = `${prefix}${key}${appendPlayerClient(youtubeArgs)}`;
  return tokens;
}

module.exports = {
  COOKIE_PLAYER_CLIENTS,
  mergeCookiePlayerClients,
};
