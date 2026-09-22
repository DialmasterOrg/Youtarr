/* eslint-env jest */

const {
  containsHttp403,
  isPoTokenAdvisory,
  isSabrRestriction,
} = require('../ytdlpStderrSignals');

const ADVISORY =
  'WARNING: [youtube] abc: mweb client https formats require a GVS PO Token which was not provided. ' +
  'They will be skipped as they may yield HTTP Error 403. You can manually pass a GVS PO Token for this client';
const SABR_WARNING =
  'WARNING: [youtube] abc: Some web_embedded client https formats have been skipped as they are missing a URL. ' +
  'YouTube may have enabled the SABR-only streaming experiment for your account.';

describe('ytdlpStderrSignals', () => {
  describe('containsHttp403', () => {
    it('matches the http error 403 line shape case-insensitively', () => {
      expect(containsHttp403('ERROR: unable to download video data: HTTP Error 403: Forbidden')).toBe(true);
      expect(containsHttp403('http error 403')).toBe(true);
    });

    it('matches the bare 403: Forbidden shape', () => {
      expect(containsHttp403('[download] Got server HTTP error: 403: Forbidden')).toBe(true);
    });

    it('ignores the PO-token advisory even though it mentions HTTP Error 403', () => {
      expect(containsHttp403(ADVISORY)).toBe(false);
    });

    it('still finds a real 403 in text that also carries the advisory', () => {
      expect(containsHttp403(`${ADVISORY}\nERROR: HTTP Error 403: Forbidden\n`)).toBe(true);
    });

    it('is false for empty or unrelated text', () => {
      expect(containsHttp403('')).toBe(false);
      expect(containsHttp403('WARNING: --paths is ignored since an absolute path is given')).toBe(false);
    });
  });

  describe('isPoTokenAdvisory', () => {
    it('recognises the advisory line', () => {
      expect(isPoTokenAdvisory(ADVISORY)).toBe(true);
    });

    it('does not match a genuine 403 error line', () => {
      expect(isPoTokenAdvisory('ERROR: HTTP Error 403: Forbidden')).toBe(false);
    });
  });

  describe('isSabrRestriction', () => {
    it('recognises the account-level SABR experiment warning', () => {
      expect(isSabrRestriction(SABR_WARNING)).toBe(true);
    });

    it('does not match the expected web-client SABR debug line', () => {
      expect(isSabrRestriction(
        '[debug] [youtube] abc: Some web client https formats have been skipped as they are missing a URL. ' +
        'YouTube is forcing SABR streaming for this client'
      )).toBe(false);
    });
  });
});
