/* eslint-env jest */

const { buildDownloadPauseContent } = require('../utils');
const {
  plainFormatter,
  discordFormatter,
  slackMarkdownFormatter,
  telegramFormatter,
  emailFormatter
} = require('../formatters');

const pausedStatus = {
  paused: true,
  reasons: [
    { type: 'usage', text: 'downloaded videos use 512.0 GB, over the 500 GB limit' },
    { type: 'freeSpace', text: 'only 12.0 GB of disk space is free, below the 50 GB minimum' }
  ]
};
const resumedStatus = { paused: false, reasons: [] };

describe('buildDownloadPauseContent', () => {
  test('titles a paused status as paused', () => {
    expect(buildDownloadPauseContent(pausedStatus).title).toBe('⏸️ Downloads Paused');
  });

  test('capitalizes each reason for display', () => {
    expect(buildDownloadPauseContent(pausedStatus).reasons[0]).toBe(
      'Downloaded videos use 512.0 GB, over the 500 GB limit'
    );
  });

  test('titles a resumed status as resumed with no reasons', () => {
    const content = buildDownloadPauseContent(resumedStatus);
    expect(content).toMatchObject({ title: '▶️ Downloads Resumed', reasons: [], footer: null });
  });

  test('tolerates a status without reasons', () => {
    expect(buildDownloadPauseContent({ paused: true }).reasons).toEqual([]);
  });
});

describe('formatDownloadPauseMessage', () => {
  test.each([
    ['plain', plainFormatter],
    ['slack', slackMarkdownFormatter],
    ['telegram', telegramFormatter],
    ['email', emailFormatter]
  ])('%s formatter includes every reason in the body', (_name, formatter) => {
    const { body } = formatter.formatDownloadPauseMessage(pausedStatus);
    expect(body).toContain('512.0 GB');
  });

  test('discord formatter lists the reasons in an embed field', () => {
    const payload = discordFormatter.formatDownloadPauseMessage(pausedStatus);
    expect(payload.embeds[0].fields[0].value).toContain('12.0 GB');
  });

  test('discord formatter colors a resumed embed differently from a paused one', () => {
    const paused = discordFormatter.formatDownloadPauseMessage(pausedStatus).embeds[0].color;
    const resumed = discordFormatter.formatDownloadPauseMessage(resumedStatus).embeds[0].color;
    expect(resumed).not.toBe(paused);
  });

  test('telegram formatter escapes HTML in reason text', () => {
    const { body } = telegramFormatter.formatDownloadPauseMessage({
      paused: true,
      reasons: [{ text: 'limit <b>x</b>' }]
    });
    expect(body).toContain('&lt;b&gt;');
  });
});

describe('formatAutoRemovalMessage usage section', () => {
  const cleanupResult = {
    totalDeleted: 2,
    deletedByAge: 0,
    deletedBySpace: 0,
    deletedByUsage: 2,
    freedBytes: 2 * 1024 ** 3,
    plan: {
      usageStrategy: {
        limit: '500GB',
        sampleVideos: [{ title: 'Old Video', channel: 'Tech Channel' }]
      }
    }
  };

  test.each([
    ['plain', plainFormatter],
    ['slack', slackMarkdownFormatter],
    ['telegram', telegramFormatter],
    ['email', emailFormatter]
  ])('%s formatter reports videos removed for the total size limit', (_name, formatter) => {
    const { body } = formatter.formatAutoRemovalMessage(cleanupResult);
    expect(body).toContain('Removed to stay under the 500GB total size limit');
  });

  test('discord formatter adds a field for the total size limit', () => {
    const payload = discordFormatter.formatAutoRemovalMessage(cleanupResult);
    expect(payload.embeds[0].fields[0].name).toContain('500GB total size limit');
  });
});
