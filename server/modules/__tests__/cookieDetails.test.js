/* eslint-env jest */
jest.mock('../../logger', () => ({ debug: jest.fn(), warn: jest.fn(), info: jest.fn() }));
jest.mock('../externalCookies', () => ({
  getExternalCookiesPath: jest.fn(() => null),
  readExternalCookies: jest.fn(),
}));
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  statSync: jest.fn(),
}));

const NOW_MS = Date.parse('2026-09-25T00:00:00Z');
const FUTURE = Math.floor(Date.parse('2027-03-01T00:00:00Z') / 1000);
const LATER = Math.floor(Date.parse('2027-06-01T00:00:00Z') / 1000);
const PAST = Math.floor(Date.parse('2026-01-01T00:00:00Z') / 1000);
const SECRET = 'super-secret-cookie-value';

function line(name, expiry, { domain = '.youtube.com', httpOnly = false } = {}) {
  const prefix = httpOnly ? '#HttpOnly_' : '';
  return `${prefix}${domain}\tTRUE\t/\tTRUE\t${expiry}\t${name}\t${SECRET}`;
}

function file(...lines) {
  return ['# Netscape HTTP Cookie File', '', ...lines].join('\n');
}

describe('cookieDetails', () => {
  let cookieDetails;
  let fs;
  let externalCookies;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    fs = require('fs');
    externalCookies = require('../externalCookies');
    externalCookies.getExternalCookiesPath.mockReturnValue(null);
    cookieDetails = require('../cookieDetails');
  });

  describe('parse', () => {
    test('counts login cookies and reports the earliest expiry', () => {
      const result = cookieDetails.parse(file(
        line('SID', LATER),
        line('__Secure-3PSID', FUTURE, { httpOnly: true }),
        line('PREF', PAST),
      ), NOW_MS);

      expect(result).toEqual({
        loginCookiesFound: 2,
        sessionLoginCookies: 0,
        expiredLoginCookies: 0,
        earliestExpiry: new Date(FUTURE * 1000).toISOString(),
        earliestExpiryName: '__Secure-3PSID',
      });
    });

    test('reads HttpOnly-prefixed lines as cookies rather than comments', () => {
      const result = cookieDetails.parse(file(line('HSID', FUTURE, { httpOnly: true })), NOW_MS);
      expect(result.loginCookiesFound).toBe(1);
    });

    test('counts login cookies that have already expired', () => {
      const result = cookieDetails.parse(file(line('SID', PAST), line('SAPISID', FUTURE)), NOW_MS);
      expect(result.expiredLoginCookies).toBe(1);
    });

    test('treats expiry 0 as a session cookie, not an expired one', () => {
      const result = cookieDetails.parse(file(line('SID', 0), line('HSID', 0)), NOW_MS);
      expect(result).toMatchObject({
        loginCookiesFound: 2,
        sessionLoginCookies: 2,
        expiredLoginCookies: 0,
        earliestExpiry: null,
        earliestExpiryName: null,
      });
    });

    test('reports zero login cookies for a signed-out export', () => {
      const result = cookieDetails.parse(file(line('PREF', FUTURE), line('VISITOR_INFO1_LIVE', FUTURE)), NOW_MS);
      expect(result.loginCookiesFound).toBe(0);
    });

    test('ignores login cookies set for other domains', () => {
      const result = cookieDetails.parse(file(line('SID', FUTURE, { domain: '.google.com' })), NOW_MS);
      expect(result.loginCookiesFound).toBe(0);
    });

    test('skips malformed lines without failing', () => {
      const result = cookieDetails.parse(file(
        '.youtube.com\tTRUE\t/\tSID',
        '.youtube.com\tTRUE\t/\tTRUE\tnot-a-number\tHSID\tvalue',
        line('SSID', FUTURE),
      ), NOW_MS);
      expect(result.loginCookiesFound).toBe(1);
    });

    test('handles Windows line endings', () => {
      const result = cookieDetails.parse(file(line('SID', FUTURE)).replace(/\n/g, '\r\n'), NOW_MS);
      expect(result.loginCookiesFound).toBe(1);
    });

    test('never includes cookie values in the output', () => {
      const result = cookieDetails.parse(file(line('SID', FUTURE), line('LOGIN_INFO', 0)), NOW_MS);
      expect(JSON.stringify(result)).not.toContain(SECRET);
    });
  });

  describe('getDetails', () => {
    test('returns null when no cookie file is active', () => {
      expect(cookieDetails.getDetails(null)).toBeNull();
    });

    test('reads an uploaded cookie file and includes its modified time', () => {
      fs.readFileSync.mockReturnValue(Buffer.from(file(line('SID', FUTURE))));
      fs.statSync.mockReturnValue({ mtime: new Date('2026-09-20T12:00:00Z') });

      const result = cookieDetails.getDetails('/app/config/cookies.user.txt');

      expect(result).toMatchObject({ loginCookiesFound: 1, lastModified: '2026-09-20T12:00:00.000Z' });
    });

    test('reads the external cookie file through the bounded external reader', () => {
      externalCookies.getExternalCookiesPath.mockReturnValue('/external/cookies.txt');
      externalCookies.readExternalCookies.mockReturnValue({
        contents: Buffer.from(file(line('SID', FUTURE))),
        lastModified: '2026-09-21T00:00:00.000Z',
      });

      const result = cookieDetails.getDetails('/external/cookies.txt');

      expect(result).toMatchObject({ loginCookiesFound: 1, lastModified: '2026-09-21T00:00:00.000Z' });
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    test('returns null when the file cannot be read', () => {
      fs.readFileSync.mockImplementation(() => {
        throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      });
      expect(cookieDetails.getDetails('/app/config/cookies.user.txt')).toBeNull();
    });
  });
});
