// YouTube's "Sign in to confirm you're not a bot" refusal, as yt-dlp reports it.
// The one place that recognizes it, so every yt-dlp caller agrees. Its wording
// lives in youtubeBlockAdvice.

const { botCheckText } = require('./youtubeBlockAdvice');

// YouTube writes the apostrophe as U+2019 and has varied the wording ("you're",
// "that you're", "you are"), so the pattern matches around that part.
const BOT_CHECK_PATTERN = /sign in to confirm.*not a bot/i;

// Named for the usual fix. Routes, other modules and the client key on it.
const BOT_CHECK_CODE = 'COOKIES_REQUIRED';

function isBotCheck(text) {
  return BOT_CHECK_PATTERN.test(String(text ?? ''));
}

function createBotCheckError({ usedCookies = false } = {}) {
  const error = new Error(botCheckText({ cookiesEnabled: usedCookies === true }));
  error.code = BOT_CHECK_CODE;
  error.usedCookies = usedCookies === true;
  return error;
}

module.exports = {
  BOT_CHECK_CODE,
  BOT_CHECK_PATTERN,
  isBotCheck,
  createBotCheckError,
};
