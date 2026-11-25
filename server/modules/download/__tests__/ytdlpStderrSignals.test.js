/* eslint-env jest */

const {
  containsHttp403,
  containsRejectedCookiesWarning,
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

    it('does not mistake a SponsorBlock API 403 for a YouTube download 403', () => {
      expect(containsHttp403('ERROR: Unable to communicate with SponsorBlock API: HTTP Error 403: Forbidden')).toBe(false);
    });

    it.each([1, 2, 3])('ignores SponsorBlock API 403 retry warning %i', (retry) => {
      expect(containsHttp403(
        `WARNING: Unable to communicate with SponsorBlock API: HTTP Error 403: Forbidden. Retrying (${retry}/3)...`
      )).toBe(false);
    });

    it('still detects a fatal SponsorBlock preprocessing 403', () => {
      expect(containsHttp403('ERROR: Preprocessing: Unable to communicate with SponsorBlock API: HTTP Error 403: Forbidden')).toBe(true);
    });

    it('still detects a real download 403 alongside a SponsorBlock API 403', () => {
      expect(containsHttp403(
        'WARNING: Unable to communicate with SponsorBlock API: HTTP Error 403: Forbidden. Retrying (1/3)...\n' +
        'ERROR: Unable to communicate with SponsorBlock API: HTTP Error 403: Forbidden\n' +
        'ERROR: unable to download video data: HTTP Error 403: Forbidden'
      )).toBe(true);
    });

    it('is false for empty or unrelated text', () => {
      expect(containsHttp403('')).toBe(false);
      expect(containsHttp403('WARNING: --paths is ignored since an absolute path is given')).toBe(false);
    });
  });

  describe('containsRejectedCookiesWarning', () => {
    const REJECTED_WARNING =
      'WARNING: [youtube] The provided YouTube account cookies are no longer valid. ' +
      'They have likely been rotated in the browser as a security measure. ' +
      'For tips on how to effectively export YouTube cookies, refer to  https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies .';

    it('matches yt-dlp\'s warning about rejected account cookies', () => {
      expect(containsRejectedCookiesWarning(REJECTED_WARNING)).toBe(true);
    });

    it('finds the warning among other output', () => {
      expect(containsRejectedCookiesWarning(
        `[youtube] Extracting URL: https://www.youtube.com/watch?v=abc123def45\n${REJECTED_WARNING}\nERROR: Join this channel\n`
      )).toBe(true);
    });

    it('matches the warning when yt-dlp names the video before it', () => {
      expect(containsRejectedCookiesWarning(
        'WARNING: [youtube] abc123def45: The provided YouTube account cookies are no longer valid.'
      )).toBe(true);
    });

    it('ignores a file error whose video title mentions rotated cookies', () => {
      expect(containsRejectedCookiesWarning(
        'ERROR: Unable to rename file: [Errno 2] No such file or directory: ' +
        '\'/tmp/Baker - My cookies got rotated [abc123def45].f137.mp4.part\''
      )).toBe(false);
    });

    it('ignores a video title that quotes the warning itself', () => {
      expect(containsRejectedCookiesWarning(
        'WARNING: [youtube] abc123def45: Unable to write \'/tmp/Why the provided YouTube account cookies are no longer valid [abc123def45].mp4\''
      )).toBe(false);
    });

    it('is false for empty text', () => {
      expect(containsRejectedCookiesWarning('')).toBe(false);
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
