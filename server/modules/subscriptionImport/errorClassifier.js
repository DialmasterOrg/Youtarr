'use strict';

const ERROR_CODES = Object.freeze({
  EXPIRED_COOKIES: 'EXPIRED_COOKIES',
  BOT_CHECK: 'BOT_CHECK',
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  NO_CHANNELS_FOUND: 'NO_CHANNELS_FOUND',
  UNKNOWN: 'UNKNOWN',
});

const USER_MESSAGES = {
  [ERROR_CODES.EXPIRED_COOKIES]:
    'Your cookies appear to be expired or invalid. Try signing into YouTube in your browser, re-exporting cookies with a browser extension, and uploading again.',
  [ERROR_CODES.BOT_CHECK]:
    'YouTube is asking for verification on this account. Sign in to YouTube in your browser, solve any challenges, then re-export your cookies and try again.',
  [ERROR_CODES.NETWORK]:
    'Could not reach YouTube. Check your internet connection and try again.',
  [ERROR_CODES.TIMEOUT]:
    'Fetching your subscriptions took too long and was cancelled. Please try again.',
  [ERROR_CODES.NO_CHANNELS_FOUND]:
    'YouTube returned no subscriptions for this account. Make sure you are signed into the right account when you exported cookies.',
  [ERROR_CODES.UNKNOWN]:
    'yt-dlp could not fetch your subscriptions. See the technical details below, or try the Google Takeout option instead.',
};

const HTTP_STATUS = {
  [ERROR_CODES.EXPIRED_COOKIES]: 502,
  [ERROR_CODES.BOT_CHECK]: 502,
  [ERROR_CODES.NETWORK]: 502,
  [ERROR_CODES.TIMEOUT]: 504,
  [ERROR_CODES.NO_CHANNELS_FOUND]: 422,
  [ERROR_CODES.UNKNOWN]: 502,
};

const PATTERNS = [
  { re: /sign in to confirm you are not a bot/i, code: ERROR_CODES.BOT_CHECK },
  { re: /captcha/i, code: ERROR_CODES.BOT_CHECK },
  { re: /please sign in/i, code: ERROR_CODES.EXPIRED_COOKIES },
  { re: /cookie.*expired/i, code: ERROR_CODES.EXPIRED_COOKIES },
  { re: /login required/i, code: ERROR_CODES.EXPIRED_COOKIES },
  {
    re: /HTTPSConnectionPool|connection refused|network is unreachable|getaddrinfo|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i,
    code: ERROR_CODES.NETWORK,
  },
];

const DETAILS_MAX_LENGTH = 500;

function tail(s, max = DETAILS_MAX_LENGTH) {
  if (!s) return '';
  const str = String(s);
  return str.length > max ? str.slice(-max) : str;
}

function classifyYtdlpError(stderr) {
  const s = stderr || '';
  for (const { re, code } of PATTERNS) {
    if (re.test(s)) {
      return {
        code,
        userMessage: USER_MESSAGES[code],
        httpStatus: HTTP_STATUS[code],
        details: tail(s),
      };
    }
  }
  return {
    code: ERROR_CODES.UNKNOWN,
    userMessage: USER_MESSAGES[ERROR_CODES.UNKNOWN],
    httpStatus: HTTP_STATUS[ERROR_CODES.UNKNOWN],
    details: tail(s),
  };
}

module.exports = { classifyYtdlpError, ERROR_CODES, USER_MESSAGES, HTTP_STATUS };
