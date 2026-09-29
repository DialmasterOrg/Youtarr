const fs = require('fs');
const logger = require('../logger');
const { getExternalCookiesPath, readExternalCookies } = require('./externalCookies');

// Cookies that carry YouTube's signed-in session. Their expiry is the earliest
// sign that an export has gone stale, well before a download fails.
const LOGIN_COOKIE_NAMES = new Set([
  'SID', 'HSID', 'SSID', 'APISID', 'SAPISID',
  '__Secure-1PSID', '__Secure-3PSID',
  '__Secure-1PAPISID', '__Secure-3PAPISID',
  'LOGIN_INFO',
]);
const YOUTUBE_DOMAIN = 'youtube.com';
// Browser exporters prefix HttpOnly cookies with this marker; they are real
// cookies, not comments, and include most of the login set.
const HTTP_ONLY_PREFIX = '#HttpOnly_';
const NETSCAPE_FIELD_COUNT = 7;
const MS_PER_SECOND = 1000;

function isYoutubeDomain(domain) {
  const host = domain.replace(/^\./, '').toLowerCase();
  return host === YOUTUBE_DOMAIN || host.endsWith(`.${YOUTUBE_DOMAIN}`);
}

function parseCookieLine(rawLine) {
  let line = rawLine.trim();
  if (line.startsWith(HTTP_ONLY_PREFIX)) line = line.slice(HTTP_ONLY_PREFIX.length);
  else if (!line || line.startsWith('#')) return null;

  const fields = line.split('\t');
  if (fields.length < NETSCAPE_FIELD_COUNT) return null;
  const [domain, , , , expiryField, name] = fields;
  const expiry = Number(expiryField);
  if (!Number.isFinite(expiry)) return null;
  return { domain, name, expiry };
}

class CookieDetails {
  /**
   * Summarize the YouTube login cookies in a Netscape cookie file. Returns
   * names and expiry times only; cookie values never leave this function.
   * @param {string} text - Cookie file contents
   * @param {number} [nowMs] - Current time, for tests
   */
  parse(text, nowMs = Date.now()) {
    const names = new Set();
    let sessionLoginCookies = 0;
    let expiredLoginCookies = 0;
    let earliest = null;

    for (const rawLine of text.split('\n')) {
      const cookie = parseCookieLine(rawLine);
      if (!cookie || !LOGIN_COOKIE_NAMES.has(cookie.name) || !isYoutubeDomain(cookie.domain)) continue;

      names.add(cookie.name);
      // Expiry 0 marks a session cookie, which has no expiry of its own.
      if (cookie.expiry <= 0) {
        sessionLoginCookies += 1;
        continue;
      }
      const expiryMs = cookie.expiry * MS_PER_SECOND;
      if (expiryMs <= nowMs) expiredLoginCookies += 1;
      if (!earliest || expiryMs < earliest.expiryMs) earliest = { expiryMs, name: cookie.name };
    }

    return {
      loginCookiesFound: names.size,
      sessionLoginCookies,
      expiredLoginCookies,
      earliestExpiry: earliest ? new Date(earliest.expiryMs).toISOString() : null,
      earliestExpiryName: earliest ? earliest.name : null,
    };
  }

  /**
   * Read and summarize the active cookie file. External files use the same
   * bounded, non-blocking read as yt-dlp operations.
   * @param {string|null} cookiesPath - configModule.getCookiesPath()
   * @returns {Object|null} Details, or null when no file is active or readable
   */
  getDetails(cookiesPath) {
    if (!cookiesPath) return null;
    try {
      let contents;
      let lastModified;
      if (cookiesPath === getExternalCookiesPath()) {
        ({ contents, lastModified } = readExternalCookies(cookiesPath));
      } else {
        contents = fs.readFileSync(cookiesPath);
        lastModified = fs.statSync(cookiesPath).mtime.toISOString();
      }
      return { ...this.parse(contents.toString('utf8')), lastModified };
    } catch (error) {
      // External read failures are already reported through the status' external.error.
      logger.debug({ code: error.code }, 'Could not read cookie file for details');
      return null;
    }
  }
}

module.exports = new CookieDetails();
