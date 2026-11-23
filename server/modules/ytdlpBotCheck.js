// YouTube's "Sign in to confirm you're not a bot" refusal, as yt-dlp reports it.
// The one place that recognizes it and words it, so every yt-dlp caller agrees.

// YouTube writes the apostrophe as U+2019 and has varied the wording ("you're",
// "that you're", "you are"), so the pattern matches around that part.
const BOT_CHECK_PATTERN = /sign in to confirm.*not a bot/i;

// Named for the usual fix. Routes, other modules and the client key on it.
const BOT_CHECK_CODE = 'COOKIES_REQUIRED';

// Both start with "Bot detection encountered": the activity page matches on it.
// Neither tells the user only to upload: uploads are refused while
// YOUTARR_COOKIES_FILE is set, and those users replace that file instead.
const MESSAGE_WITH_COOKIES =
  'Bot detection encountered even though cookies are configured - they are likely expired or rotated. ' +
  'Re-export fresh cookies from your browser, then upload them in Settings -> Cookies, ' +
  'or replace the file if you use YOUTARR_COOKIES_FILE.';
const MESSAGE_WITHOUT_COOKIES =
  'Bot detection encountered. YouTube is temporarily refusing requests from this server; ' +
  'this usually clears on its own, so try again later. ' +
  'If it keeps happening, set up YouTube cookies in Settings -> Cookies.';

function isBotCheck(text) {
  return BOT_CHECK_PATTERN.test(String(text ?? ''));
}

function botCheckMessage(usedCookies) {
  return usedCookies ? MESSAGE_WITH_COOKIES : MESSAGE_WITHOUT_COOKIES;
}

function createBotCheckError({ usedCookies = false } = {}) {
  const error = new Error(botCheckMessage(usedCookies === true));
  error.code = BOT_CHECK_CODE;
  error.usedCookies = usedCookies === true;
  return error;
}

module.exports = {
  BOT_CHECK_CODE,
  BOT_CHECK_PATTERN,
  isBotCheck,
  botCheckMessage,
  createBotCheckError,
};
