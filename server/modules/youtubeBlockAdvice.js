// Every user-facing sentence about YouTube refusing a request: its bot check
// and HTTP 403, for lookups, live download messages, job records and the
// "Likely cause" diagnoses. One place, so the surfaces cannot drift apart.
// Pure wording: recognizing a bot check is ytdlpBotCheck's job.

const KIND = {
  BOT_CHECK: 'bot-check',
  HTTP_403: 'http-403',
};

// Covers both cookie setups, because uploads are refused while an external
// cookie file is configured. The texts name no environment variable: they
// reach Slack notifications, which wrap them in underscores for italics.
const REFRESH_COOKIES =
  'Re-export fresh cookies from your browser, then upload them in ' +
  'Settings -> Cookies or replace your external cookie file.';

// The no-cookies fallback runs without the configured cookies on purpose, so
// it is a third state with no cookie advice, not a run that lacks cookies.
function cookieState({ anonymousRetry = false, cookiesEnabled = false } = {}) {
  if (anonymousRetry) return 'anonymous-retry';
  return cookiesEnabled ? 'cookies-enabled' : 'cookies-disabled';
}

function adviceKey(kind, context) {
  return `${kind}-${cookieState(context)}`;
}

// Plain-language diagnoses, keyed by adviceKey. Download History and the
// Sonarr/Radarr bridge show the titles, and failureAdvisor.isYoutubeBlock
// reads the keys, so reword only the messages.
const ADVICE = {
  'http-403-cookies-enabled': {
    title: 'YouTube blocked the download while using your cookies',
    message:
      'YouTube blocked this download while using your cookies. Cookies ' +
      'that are stale or rotated are the most common cause. ' +
      `${REFRESH_COOKIES} If fresh cookies still fail, temporarily disable ` +
      'cookies and retry - many videos download fine without them.',
  },
  'http-403-cookies-disabled': {
    title: 'YouTube blocked the download',
    message:
      'YouTube blocked this download. This is sometimes temporary - ' +
      'retrying later can work. If it keeps failing, setting up YouTube ' +
      'cookies in Settings -> Cookies often resolves it.',
  },
  'http-403-anonymous-retry': {
    title: 'No-cookies fallback also failed',
    message:
      'The no-cookies fallback was also blocked by YouTube. This video may ' +
      'be genuinely unavailable.',
  },
  'bot-check-cookies-enabled': {
    title: 'YouTube bot check despite cookies',
    message:
      'YouTube flagged this download as automated even though cookies are ' +
      `configured - they are likely expired or rotated. ${REFRESH_COOKIES}`,
  },
  'bot-check-cookies-disabled': {
    title: 'YouTube bot check (usually temporary)',
    message:
      'YouTube asked this server to sign in before serving the video. ' +
      'Without cookies this is usually a temporary block on the server\'s ' +
      'IP address that clears on its own. Videos from subscribed channels ' +
      'and playlists are retried automatically on the next scheduled ' +
      'download; a manual download can be run again later. If it keeps ' +
      'happening across several runs, set up YouTube cookies in ' +
      'Settings -> Cookies.',
  },
  'bot-check-anonymous-retry': {
    title: 'No-cookies fallback also failed',
    message:
      'YouTube rejected the no-cookies fallback with a bot check. This video ' +
      'may be genuinely unavailable.',
  },
};

function adviceFor(kind, context) {
  return ADVICE[adviceKey(kind, context)];
}

// The bot check as one line for lookups and live download messages. Every
// reason starts with "Bot detection encountered": the activity page matches
// on it. `fix` is what to do about it, absent when there is nothing to do.
const BOT_CHECK_TEXT = {
  'cookies-enabled': {
    reason: 'Bot detection encountered even though cookies are configured - they are likely expired or rotated.',
    fix: REFRESH_COOKIES,
  },
  'cookies-disabled': {
    reason:
      'Bot detection encountered. YouTube is temporarily refusing requests from this server; ' +
      'this usually clears on its own, so try again later.',
    fix: 'If it keeps happening, set up YouTube cookies in Settings -> Cookies.',
  },
  'anonymous-retry': {
    reason:
      'Bot detection encountered during the no-cookies fallback. ' +
      'The fallback also failed, so this video may be genuinely unavailable.',
  },
};

// The reason alone, for a job's stored output and the run summaries built
// from it, which say what stopped a job rather than what to do next.
function botCheckSummary(context) {
  return BOT_CHECK_TEXT[cookieState(context)].reason;
}

function botCheckText(context) {
  const { reason, fix } = BOT_CHECK_TEXT[cookieState(context)];
  return fix ? `${reason} ${fix}` : reason;
}

// A 403 seen while a download is still running. It is often recoverable, so
// the hint is conditional on the download failing.
const HTTP_403_HINT = {
  'cookies-enabled':
    `HTTP 403 detected while using your cookies. If the download fails, they may be stale. ${REFRESH_COOKIES} ` +
    'You can also disable cookies in Settings -> Cookies.',
  'cookies-disabled':
    'HTTP 403 detected: YouTube may be blocking requests. If the download fails, ' +
    'setting up YouTube cookies in Settings -> Cookies may help.',
  'anonymous-retry':
    'HTTP 403 detected during the no-cookies fallback. If this retry fails, the video may be genuinely unavailable.',
};

function http403Hint(context) {
  return HTTP_403_HINT[cookieState(context)];
}

module.exports = {
  KIND,
  ADVICE,
  adviceKey,
  adviceFor,
  botCheckText,
  botCheckSummary,
  http403Hint,
};
