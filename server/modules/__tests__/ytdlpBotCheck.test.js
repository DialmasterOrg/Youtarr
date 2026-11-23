/* eslint-env jest */
const {
  BOT_CHECK_CODE,
  BOT_CHECK_PATTERN,
  isBotCheck,
  botCheckMessage,
  createBotCheckError,
} = require('../ytdlpBotCheck');

// stderr of a real bot-checked metadata fetch (yt-dlp 2026.11.22).
const REAL_STDERR =
  'WARNING: [youtube] No title found in player responses; falling back to title from initial data. Other metadata may also be missing\n' +
  'ERROR: [youtube] DpCGv8hzK2I: Sign in to confirm you’re not a bot. This helps protect our community. ' +
  'Use --cookies-from-browser or --cookies for the authentication.\n';

describe('ytdlpBotCheck', () => {
  describe('isBotCheck', () => {
    it.each([
      ['the typographic apostrophe YouTube sends', 'Sign in to confirm you’re not a bot'],
      ['a straight apostrophe', 'Sign in to confirm you\'re not a bot'],
      ['the "that you\'re" wording', 'Sign in to confirm that you’re not a bot'],
      ['the "you are" wording', 'ERROR: Sign in to confirm you are not a bot'],
      ['a full stderr buffer', REAL_STDERR],
    ])('matches %s', (_label, text) => {
      expect(isBotCheck(text)).toBe(true);
    });

    it.each([
      ['an age check', 'ERROR: [youtube] abc: Sign in to confirm your age. This video may be inappropriate for some users.'],
      ['a members-only refusal', 'ERROR: Join this channel to get access to members-only content'],
      ['the two halves on different lines', 'Sign in to confirm your age\nWARNING: not a bot'],
      ['an empty string', ''],
      ['undefined', undefined],
      ['null', null],
    ])('does not match %s', (_label, text) => {
      expect(isBotCheck(text)).toBe(false);
    });
  });

  it('exposes the pattern for classifier tables', () => {
    expect(BOT_CHECK_PATTERN.test(REAL_STDERR)).toBe(true);
  });

  describe('botCheckMessage', () => {
    it('calls the block temporary when the run sent no cookies', () => {
      expect(botCheckMessage(false)).toMatch(/usually clears on its own/);
    });

    it('points at the cookies when the run sent them', () => {
      expect(botCheckMessage(true)).toMatch(/likely expired or rotated/);
    });

    // Uploads are refused while YOUTARR_COOKIES_FILE is set, so advice that
    // only says "upload" sends those users to a control that is not there.
    it('covers both uploaded cookies and an external cookie file when cookies were sent', () => {
      expect(botCheckMessage(true)).toMatch(/upload them in Settings -> Cookies/);
      expect(botCheckMessage(true)).toMatch(/YOUTARR_COOKIES_FILE/);
    });

    it('does not tell a cookieless run to upload, which an external cookie file rules out', () => {
      expect(botCheckMessage(false)).toMatch(/set up YouTube cookies in Settings -> Cookies/);
      expect(botCheckMessage(false)).not.toMatch(/upload/i);
    });

    it('keeps the prefix the activity page matches on', () => {
      expect(botCheckMessage(false)).toMatch(/^Bot detection encountered/);
      expect(botCheckMessage(true)).toMatch(/^Bot detection encountered/);
    });
  });

  describe('createBotCheckError', () => {
    it('builds an error with the bot check code and the matching message', () => {
      const error = createBotCheckError({ usedCookies: true });

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(BOT_CHECK_CODE);
      expect(error.usedCookies).toBe(true);
      expect(error.message).toBe(botCheckMessage(true));
    });

    it('treats a run with unknown cookie use as cookieless', () => {
      const error = createBotCheckError();

      expect(error.usedCookies).toBe(false);
      expect(error.message).toBe(botCheckMessage(false));
    });
  });

  it('keeps the code other modules and the client already key on', () => {
    expect(BOT_CHECK_CODE).toBe('COOKIES_REQUIRED');
  });
});
