/* eslint-env jest */
const {
  KIND,
  ADVICE,
  adviceKey,
  adviceFor,
  botCheckText,
  botCheckSummary,
  http403Hint,
} = require('../youtubeBlockAdvice');

const WITH_COOKIES = { cookiesEnabled: true };
const WITHOUT_COOKIES = { cookiesEnabled: false };
// The fallback runs without cookies even though they are configured.
const FALLBACK = { cookiesEnabled: true, anonymousRetry: true };

// Uploads are refused while YOUTARR_COOKIES_FILE is set, so advice that only
// says "upload" sends those users to a control that is not there. The two
// options are checked apart, so they can be reordered or reworded around.
// This file is the only one that pins the wording: consumer tests compare
// what they emit or store with what these functions return.
const expectBothCookieSetups = (text) => {
  expect(text).toMatch(/upload them in Settings -> Cookies/);
  expect(text).toMatch(/replace your external cookie file/);
};
const COOKIE_ADVICE = /upload|re-export|set up .*cookies|setting up .*cookies|enable.*cookies/i;

describe('youtubeBlockAdvice', () => {
  describe('adviceKey', () => {
    it.each([
      [KIND.BOT_CHECK, WITH_COOKIES, 'bot-check-cookies-enabled'],
      [KIND.BOT_CHECK, WITHOUT_COOKIES, 'bot-check-cookies-disabled'],
      [KIND.BOT_CHECK, FALLBACK, 'bot-check-anonymous-retry'],
      [KIND.HTTP_403, WITH_COOKIES, 'http-403-cookies-enabled'],
      [KIND.HTTP_403, WITHOUT_COOKIES, 'http-403-cookies-disabled'],
      [KIND.HTTP_403, FALLBACK, 'http-403-anonymous-retry'],
    ])('keys %s with %j as %s', (kind, context, expected) => {
      expect(adviceKey(kind, context)).toBe(expected);
    });

    it('treats a missing context as a run without cookies', () => {
      expect(adviceKey(KIND.BOT_CHECK)).toBe('bot-check-cookies-disabled');
    });
  });

  describe('adviceFor', () => {
    it('returns the title and message of the matching entry', () => {
      expect(adviceFor(KIND.HTTP_403, WITH_COOKIES)).toBe(ADVICE['http-403-cookies-enabled']);
    });

    it('has an entry with a title and a message for every kind and cookie state', () => {
      for (const kind of Object.values(KIND)) {
        for (const context of [WITH_COOKIES, WITHOUT_COOKIES, FALLBACK]) {
          expect(adviceFor(kind, context)).toEqual({
            title: expect.any(String),
            message: expect.any(String),
          });
        }
      }
    });

    it.each([KIND.BOT_CHECK, KIND.HTTP_403])('covers both cookie setups when %s hit a run that sent cookies', (kind) => {
      expectBothCookieSetups(adviceFor(kind, WITH_COOKIES).message);
    });

    it.each([KIND.BOT_CHECK, KIND.HTTP_403])('does not tell a cookieless run to upload after %s', (kind) => {
      const { message } = adviceFor(kind, WITHOUT_COOKIES);
      expect(message).toMatch(/Settings -> Cookies/);
      expect(message).not.toMatch(/upload/i);
    });

    it.each([KIND.BOT_CHECK, KIND.HTTP_403])('gives no cookie advice when %s hit the no-cookies fallback', (kind) => {
      const { message } = adviceFor(kind, FALLBACK);
      expect(message).toMatch(/no-cookies fallback/i);
      expect(message).not.toMatch(COOKIE_ADVICE);
    });

    it('calls a cookieless bot check temporary before suggesting cookies', () => {
      expect(adviceFor(KIND.BOT_CHECK, WITHOUT_COOKIES).message).toMatch(/usually a temporary block/);
    });
  });

  describe('botCheckText', () => {
    it('calls the block temporary when the run sent no cookies', () => {
      expect(botCheckText(WITHOUT_COOKIES)).toMatch(/usually clears on its own/);
      expect(botCheckText(WITHOUT_COOKIES)).toMatch(/set up YouTube cookies in Settings -> Cookies/);
      expect(botCheckText(WITHOUT_COOKIES)).not.toMatch(/upload/i);
    });

    it('points at the cookies, for both setups, when the run sent them', () => {
      expect(botCheckText(WITH_COOKIES)).toMatch(/likely expired or rotated/);
      expectBothCookieSetups(botCheckText(WITH_COOKIES));
    });

    it('gives no cookie advice for the no-cookies fallback', () => {
      expect(botCheckText(FALLBACK)).toMatch(/no-cookies fallback/i);
      expect(botCheckText(FALLBACK)).not.toMatch(COOKIE_ADVICE);
    });

    it.each([
      ['with cookies', WITH_COOKIES],
      ['without cookies', WITHOUT_COOKIES],
      ['in the fallback', FALLBACK],
    ])('keeps the prefix the activity page matches on, %s', (_label, context) => {
      expect(botCheckText(context)).toMatch(/^Bot detection encountered/);
    });

    // Slack notifications wrap text in underscores for italics.
    it('names no environment variable, whose underscores could break notification formatting', () => {
      const everyText = [
        ...Object.values(ADVICE).map((entry) => entry.message),
        ...[WITH_COOKIES, WITHOUT_COOKIES, FALLBACK].flatMap((context) => [botCheckText(context), http403Hint(context)]),
      ];
      everyText.forEach((text) => expect(text).not.toMatch(/_/));
    });
  });

  // Consumer tests compare against these functions, which only proves the
  // right cookie state was passed if each state reads differently.
  it.each([
    ['botCheckText', botCheckText],
    ['botCheckSummary', botCheckSummary],
    ['http403Hint', http403Hint],
    ['bot check advice', (context) => adviceFor(KIND.BOT_CHECK, context).message],
    ['HTTP 403 advice', (context) => adviceFor(KIND.HTTP_403, context).message],
  ])('%s reads differently for each cookie state', (_label, textFor) => {
    const texts = [WITH_COOKIES, WITHOUT_COOKIES, FALLBACK].map(textFor);
    expect(new Set(texts).size).toBe(3);
  });

  it('words a bot check and an HTTP 403 differently in every cookie state', () => {
    [WITH_COOKIES, WITHOUT_COOKIES, FALLBACK].forEach((context) => {
      expect(adviceFor(KIND.BOT_CHECK, context).message).not.toBe(adviceFor(KIND.HTTP_403, context).message);
    });
  });

  describe('botCheckSummary', () => {
    it.each([
      ['with cookies', WITH_COOKIES],
      ['without cookies', WITHOUT_COOKIES],
      ['in the fallback', FALLBACK],
    ])('is the opening of the full text, %s', (_label, context) => {
      expect(botCheckText(context).startsWith(botCheckSummary(context))).toBe(true);
    });

    it('leaves the fix out, since it names a job and not what to do', () => {
      expect(botCheckSummary(WITH_COOKIES)).not.toMatch(COOKIE_ADVICE);
      expect(botCheckSummary(WITHOUT_COOKIES)).not.toMatch(COOKIE_ADVICE);
    });
  });

  describe('http403Hint', () => {
    it('speaks of a run still in progress', () => {
      expect(http403Hint(WITH_COOKIES)).toMatch(/^HTTP 403 detected/);
      expect(http403Hint(WITHOUT_COOKIES)).toMatch(/^HTTP 403 detected/);
      expect(http403Hint(FALLBACK)).toMatch(/^HTTP 403 detected/);
    });

    it('covers both cookie setups when the run sent cookies', () => {
      expectBothCookieSetups(http403Hint(WITH_COOKIES));
    });

    it('also offers disabling cookies when the run sent them', () => {
      expect(http403Hint(WITH_COOKIES)).toMatch(/disable cookies in Settings -> Cookies/);
    });

    it('points a cookieless run at Settings, not at the old Configuration page', () => {
      expect(http403Hint(WITHOUT_COOKIES)).toMatch(/Settings -> Cookies/);
      expect(http403Hint(WITHOUT_COOKIES)).not.toMatch(/Configuration|upload/i);
    });

    it('gives no cookie advice for the no-cookies fallback', () => {
      expect(http403Hint(FALLBACK)).toMatch(/no-cookies fallback/i);
      expect(http403Hint(FALLBACK)).not.toMatch(COOKIE_ADVICE);
    });
  });
});
