/* eslint-env jest */
const {
  BOT_CHECK_CODE,
  BOT_CHECK_PATTERN,
  isBotCheck,
  createBotCheckError,
} = require('../ytdlpBotCheck');
const { botCheckText } = require('../youtubeBlockAdvice');

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

  describe('createBotCheckError', () => {
    it('builds an error with the bot check code and the wording for a run that sent cookies', () => {
      const error = createBotCheckError({ usedCookies: true });

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(BOT_CHECK_CODE);
      expect(error.usedCookies).toBe(true);
      expect(error.message).toBe(botCheckText({ cookiesEnabled: true }));
    });

    it('treats a run with unknown cookie use as cookieless', () => {
      const error = createBotCheckError();

      expect(error.usedCookies).toBe(false);
      expect(error.message).toBe(botCheckText({ cookiesEnabled: false }));
    });

    it('words the two cookie states differently', () => {
      expect(createBotCheckError({ usedCookies: true }).message)
        .not.toBe(createBotCheckError({ usedCookies: false }).message);
    });
  });

  it('keeps the code other modules and the client already key on', () => {
    expect(BOT_CHECK_CODE).toBe('COOKIES_REQUIRED');
  });
});
