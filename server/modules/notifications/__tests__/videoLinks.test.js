/* eslint-env jest */

const { getLinkTemplateError, buildVideoLink } = require('../utils');
const {
  discordFormatter,
  slackMarkdownFormatter,
  telegramFormatter,
  emailFormatter,
  plainFormatter
} = require('../formatters');

const TEMPLATE = 'https://youtarr.example.com/videos?video={youtubeId}';
const LINK = 'https://youtarr.example.com/videos?video=abc123XYZ_-';

const summary = { totalDownloaded: 1, jobType: 'Channel Downloads' };
const video = {
  youtubeId: 'abc123XYZ_-',
  youTubeChannelName: 'Tech Channel',
  youTubeVideoName: 'How to Code',
  duration: 600
};

describe('getLinkTemplateError', () => {
  it.each([undefined, null, '', '   '])('accepts an empty template (%p)', (template) => {
    expect(getLinkTemplateError(template)).toBeNull();
  });

  it.each([
    TEMPLATE,
    'http://192.168.1.10:3087/videos?video={youtubeId}',
    'https://example.com/protect/{youtubeId}/now',
    'https://www.youtube.com/watch?v={youtubeId}',
    'https://example.com/fixed-page'
  ])('accepts %s', (template) => {
    expect(getLinkTemplateError(template)).toBeNull();
  });

  it('rejects a value that is not text', () => {
    expect(getLinkTemplateError(42)).toBe('Link template must be text.');
  });

  it.each([
    'youtarr.example.com/{youtubeId}',
    'ftp://example.com/{youtubeId}',
    'javascript:alert(1)//{youtubeId}',
    'data:text/html,{youtubeId}'
  ])('rejects %s because it is not an http or https URL', (template) => {
    expect(getLinkTemplateError(template)).toBe(
      'Link template must be a full URL that starts with http:// or https://.'
    );
  });

  it.each(['https://example.com/{id}', 'https://example.com/{youtubeid}', 'https://example.com/{youtubeId'])(
    'rejects %s because it uses another variable',
    (template) => {
      expect(getLinkTemplateError(template)).toBe('Link template can only use the variable {youtubeId}.');
    }
  );

  it('rejects a template over 500 characters', () => {
    expect(getLinkTemplateError(`https://example.com/${'a'.repeat(500)}`)).toBe(
      'Link template must have at most 500 characters.'
    );
  });
});

describe('buildVideoLink', () => {
  it('puts the youtubeId in the template', () => {
    expect(buildVideoLink(TEMPLATE, video)).toBe(LINK);
  });

  it('replaces every occurrence of the variable', () => {
    expect(buildVideoLink('https://example.com/{youtubeId}/page?id={youtubeId}', video)).toBe(
      'https://example.com/abc123XYZ_-/page?id=abc123XYZ_-'
    );
  });

  it('ignores spaces around the template', () => {
    expect(buildVideoLink(`  ${TEMPLATE}  `, video)).toBe(LINK);
  });

  it.each([undefined, null, '', '   ', 42])('returns null for the template %p', (template) => {
    expect(buildVideoLink(template, video)).toBeNull();
  });

  it.each(['javascript:alert(1)//{youtubeId}', 'https://example.com/{id}'])(
    'returns null for the invalid template %s',
    (template) => {
      expect(buildVideoLink(template, video)).toBeNull();
    }
  );

  it.each([
    ['no youtubeId', {}],
    ['no video', undefined],
    ['a youtubeId with spaces', { youtubeId: 'bad id here' }],
    ['a youtubeId with a slash', { youtubeId: '../../etc/passwd' }],
    ['a youtubeId that is too short', { youtubeId: 'abc' }]
  ])('returns null for a video with %s', (_label, target) => {
    expect(buildVideoLink(TEMPLATE, target)).toBeNull();
  });
});

describe('video links in download notifications', () => {
  const discordValue = (message) => message.embeds[0].fields[0].value;

  describe('Discord', () => {
    it('links the video title', () => {
      const message = discordFormatter.formatDownloadMessage(summary, [video], { linkTemplate: TEMPLATE });
      expect(discordValue(message)).toBe(`[How to Code](${LINK})\n⏱️ 10:00`);
    });

    it('escapes brackets in the title', () => {
      const tricky = { ...video, youTubeVideoName: 'Part [2] of the series' };
      const message = discordFormatter.formatDownloadMessage(summary, [tricky], { linkTemplate: TEMPLATE });
      expect(discordValue(message)).toContain('[Part \\[2\\] of the series](');
    });

    it('encodes parentheses in the URL', () => {
      const message = discordFormatter.formatDownloadMessage(summary, [video], {
        linkTemplate: 'https://example.com/page(1)?v={youtubeId}'
      });
      expect(discordValue(message)).toContain('(https://example.com/page%281%29?v=abc123XYZ_-)');
    });

    it('keeps the plain title without a template', () => {
      const message = discordFormatter.formatDownloadMessage(summary, [video]);
      expect(discordValue(message)).toBe('How to Code\n⏱️ 10:00');
    });

    it('keeps the plain title for a video without a youtubeId', () => {
      const withoutId = { ...video, youtubeId: undefined };
      const message = discordFormatter.formatDownloadMessage(summary, [withoutId], { linkTemplate: TEMPLATE });
      expect(discordValue(message)).toBe('How to Code\n⏱️ 10:00');
    });

    it('stays under the Discord field limit for the longest template and title', () => {
      const longTemplate = `https://example.com/${'a'.repeat(460)}/{youtubeId}`;
      const longTitle = { ...video, youTubeVideoName: 'T'.repeat(200) };
      const message = discordFormatter.formatDownloadMessage(summary, [longTitle], { linkTemplate: longTemplate });
      expect(discordValue(message).length).toBeLessThanOrEqual(1024);
    });
  });

  describe('Slack', () => {
    const slackBody = (title, template = TEMPLATE) => slackMarkdownFormatter.formatDownloadMessage(
      summary,
      [{ ...video, youTubeVideoName: title }],
      { linkTemplate: template }
    ).body;

    it('links the video title as a Markdown link that Apprise converts for Slack', () => {
      expect(slackBody('How to Code')).toContain(`[How to Code](<${LINK}>)`);
    });

    it('uses the same link form for a one-word title', () => {
      expect(slackBody('Trailer')).toContain(`[Trailer](<${LINK}>)`);
    });

    it('keeps a pipe in the URL inside the angle brackets', () => {
      const body = slackBody('How to Code', 'https://example.com/a|b?v={youtubeId}');
      expect(body).toContain('[How to Code](<https://example.com/a|b?v=abc123XYZ_->)');
    });

    it('escapes angle brackets in the title with a backslash', () => {
      expect(slackBody('a > b <c>')).toContain('[a \\> b \\<c\\>](');
    });

    it('escapes square brackets in the title with a backslash', () => {
      expect(slackBody('Part [2 of the series')).toContain('[Part \\[2 of the series](');
    });

    it('escapes a backslash in the title so it cannot escape the closing bracket', () => {
      expect(slackBody('C:\\dir\\')).toContain('[C:\\\\dir\\\\](');
    });

    it('replaces a backtick in the title with an apostrophe', () => {
      expect(slackBody('Don`t Stop')).toContain(`[Don't Stop](<${LINK}>)`);
    });

    it('keeps each link on its own URL when two titles use a backtick', () => {
      const first = { ...video, youTubeVideoName: 'Don`t Stop' };
      const second = { ...video, youtubeId: 'zzz999AAA_-', youTubeVideoName: 'Rock`n Roll' };
      const secondLink = 'https://youtarr.example.com/videos?video=zzz999AAA_-';
      const { body } = slackMarkdownFormatter.formatDownloadMessage(
        summary,
        [first, second],
        { linkTemplate: TEMPLATE }
      );

      expect(body).not.toContain('`');
      expect(body).toContain(`[Don't Stop](<${LINK}>)`);
      expect(body).toContain(`[Rock'n Roll](<${secondLink}>)`);
    });

    it('does not escape an ampersand because Apprise already does', () => {
      expect(slackBody('Tom & Jerry')).toContain('[Tom & Jerry](');
    });

    it('keeps the plain title without a template', () => {
      const message = slackMarkdownFormatter.formatDownloadMessage(summary, [video]);
      expect(message.body).toContain('\nHow to Code\n');
      expect(message.body).not.toContain('](<');
    });
  });

  describe('Telegram', () => {
    it('links the video title in HTML', () => {
      const message = telegramFormatter.formatDownloadMessage(summary, [video], { linkTemplate: TEMPLATE });
      expect(message.body).toContain(`<a href="${LINK}">How to Code</a>`);
    });

    it('escapes the URL and the title', () => {
      const tricky = { ...video, youTubeVideoName: 'Tom & Jerry <live>' };
      const message = telegramFormatter.formatDownloadMessage(summary, [tricky], {
        linkTemplate: 'https://example.com/?a=1&v={youtubeId}'
      });
      expect(message.body).toContain(
        '<a href="https://example.com/?a=1&amp;v=abc123XYZ_-">Tom &amp; Jerry &lt;live&gt;</a>'
      );
    });

    it('keeps the plain title without a template', () => {
      const message = telegramFormatter.formatDownloadMessage(summary, [video]);
      expect(message.body).toContain('\nHow to Code\n');
      expect(message.body).not.toContain('<a href');
    });
  });

  describe('Email', () => {
    it('links the video title in HTML', () => {
      const message = emailFormatter.formatDownloadMessage(summary, [video], { linkTemplate: TEMPLATE });
      expect(message.body).toContain(`<div class="video-title"><a href="${LINK}">How to Code</a></div>`);
    });

    it('keeps the plain title without a template', () => {
      const message = emailFormatter.formatDownloadMessage(summary, [video]);
      expect(message.body).toContain('<div class="video-title">How to Code</div>');
    });
  });

  describe('Plain text', () => {
    it('adds no link', () => {
      const message = plainFormatter.formatDownloadMessage(summary, [video], { linkTemplate: TEMPLATE });
      expect(message.body).not.toContain('youtarr.example.com');
    });
  });

  describe.each([
    ['Discord', (template) => JSON.stringify(discordFormatter.formatDownloadMessage(summary, [video], { linkTemplate: template }))],
    ['Slack', (template) => slackMarkdownFormatter.formatDownloadMessage(summary, [video], { linkTemplate: template }).body],
    ['Telegram', (template) => telegramFormatter.formatDownloadMessage(summary, [video], { linkTemplate: template }).body],
    ['Email', (template) => emailFormatter.formatDownloadMessage(summary, [video], { linkTemplate: template }).body]
  ])('%s with an unsafe template', (_name, render) => {
    it('adds no link for a javascript: URL', () => {
      expect(render('javascript:alert(1)//{youtubeId}')).not.toContain('javascript:');
    });
  });
});
