/* eslint-env jest */

const { buildCookiesInvalidContent } = require('../utils');
const {
  plainFormatter,
  discordFormatter,
  slackMarkdownFormatter,
  telegramFormatter,
  emailFormatter
} = require('../formatters');

const uploadedRejected = { reason: 'rejected', external: false, detail: null };
const externalRejected = { reason: 'rejected', external: true, detail: null };
const externalUnusable = {
  reason: 'unusable',
  external: true,
  detail: 'External cookies: yt-dlp could not load the file <cookies.txt>.'
};

describe('buildCookiesInvalidContent', () => {
  test('sends the owner of uploaded cookies to the Cookies settings page', () => {
    expect(buildCookiesInvalidContent(uploadedRejected).action).toContain('Settings > Cookies');
  });

  test('sends the owner of an external cookie file to that file, not to an upload it would refuse', () => {
    const { action } = buildCookiesInvalidContent(externalRejected);

    expect(action).toContain('external cookie file');
    expect(action).not.toContain('Settings > Cookies');
  });

  test('says YouTube stopped accepting the cookies when they were rejected', () => {
    expect(buildCookiesInvalidContent(uploadedRejected).summary).toContain('YouTube no longer accepts');
  });

  test('gives the file problem when the cookie file cannot be used', () => {
    const { summary } = buildCookiesInvalidContent(externalUnusable);

    expect(summary).toContain('yt-dlp could not load the file');
    expect(summary).not.toContain('YouTube no longer accepts');
  });

  test('tolerates an unusable file without a detail', () => {
    const { summary } = buildCookiesInvalidContent({ reason: 'unusable', external: true, detail: null });

    expect(summary).not.toContain('null');
  });

  test('says what keeps working and what stops', () => {
    const { effect } = buildCookiesInvalidContent(uploadedRejected);

    expect(effect).toContain('Public videos keep downloading');
    expect(effect).toContain('members-only');
  });

  // Slack wraps the action in underscores for italics; one inside the text ends them early.
  test.each([
    ['uploaded cookies', uploadedRejected],
    ['an external cookie file', externalRejected]
  ])('keeps underscores out of the action for %s', (_name, info) => {
    expect(buildCookiesInvalidContent(info).action).not.toContain('_');
  });
});

describe('formatCookiesInvalidMessage', () => {
  const textFormatters = [
    ['plain', plainFormatter],
    ['slack', slackMarkdownFormatter],
    ['telegram', telegramFormatter],
    ['email', emailFormatter]
  ];

  test.each(textFormatters)('%s formatter titles the message with the shared title', (_name, formatter) => {
    const { title } = formatter.formatCookiesInvalidMessage(uploadedRejected);

    expect(title).toBe(buildCookiesInvalidContent(uploadedRejected).title);
  });

  test.each(textFormatters)('%s formatter says what happened, what it affects and what to do', (_name, formatter) => {
    const { body } = formatter.formatCookiesInvalidMessage(externalRejected);

    expect(body).toContain('YouTube no longer accepts');
    expect(body).toContain('members-only');
    expect(body).toContain('external cookie file');
  });

  test('discord formatter puts the summary in the embed and the advice in fields', () => {
    const embed = discordFormatter.formatCookiesInvalidMessage(externalRejected).embeds[0];

    expect(embed.description).toContain('YouTube no longer accepts');
    expect(embed.fields.map((field) => field.value).join('\n')).toContain('external cookie file');
  });

  test.each([
    ['telegram', telegramFormatter],
    ['email', emailFormatter]
  ])('%s formatter escapes HTML in the file problem', (_name, formatter) => {
    const { body } = formatter.formatCookiesInvalidMessage(externalUnusable);

    expect(body).toContain('&lt;cookies.txt&gt;');
    expect(body).not.toContain('<cookies.txt>');
  });
});
