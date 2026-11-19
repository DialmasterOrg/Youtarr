/* eslint-env jest */
const { renderRss, escapeXml } = require('../rssWriter');

const PUBLISHED = new Date('2026-11-05T12:29:00.000Z');
const PUBLISHED_RFC822 = 'Thu, 05 Nov 2026 12:29:00 GMT';

const makeChannel = (overrides = {}) => ({
  title: 'Youtarr downloads',
  link: 'https://youtarr.example.com',
  description: 'Recently downloaded videos',
  lastBuildDate: PUBLISHED,
  items: [],
  ...overrides,
});

const makeItem = (overrides = {}) => ({
  title: 'A video',
  link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  guid: 'youtarr:video:dQw4w9WgXcQ',
  pubDate: PUBLISHED,
  creator: 'A channel',
  thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  description: '<p>Body</p>',
  ...overrides,
});

describe('escapeXml', () => {
  test('escapes the five XML special characters', () => {
    expect(escapeXml('Tom & "Jerry" <live> it\'s')).toBe(
      'Tom &amp; &quot;Jerry&quot; &lt;live&gt; it&apos;s'
    );
  });

  test('removes control characters XML 1.0 does not allow', () => {
    expect(escapeXml('a\u0000b\u000bc\u001fd')).toBe('abcd');
  });

  test('removes the noncharacters U+FFFE and U+FFFF', () => {
    expect(escapeXml('a￾b￿c')).toBe('abc');
  });

  test('removes an unpaired surrogate left by cutting a string', () => {
    expect(escapeXml('a\uD83Db')).toBe('ab');
  });

  test('keeps tabs, newlines and emoji', () => {
    expect(escapeXml('a\tb\nc\r\u{1F600}')).toBe('a\tb\nc\r\u{1F600}');
  });

  test('turns null and undefined into an empty string', () => {
    expect(escapeXml(null)).toBe('');
    expect(escapeXml(undefined)).toBe('');
  });
});

describe('renderRss', () => {
  test('writes an RSS 2.0 document with the namespaces its items use', () => {
    const xml = renderRss(makeChannel());

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
    expect(xml).toContain(
      '<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">'
    );
    expect(xml.trim().endsWith('</channel>\n</rss>')).toBe(true);
  });

  test('writes the channel fields', () => {
    const xml = renderRss(makeChannel());

    expect(xml).toContain('<title>Youtarr downloads</title>');
    expect(xml).toContain('<link>https://youtarr.example.com</link>');
    expect(xml).toContain('<description>Recently downloaded videos</description>');
    expect(xml).toContain(`<lastBuildDate>${PUBLISHED_RFC822}</lastBuildDate>`);
  });

  test('leaves out lastBuildDate when the feed has no date', () => {
    expect(renderRss(makeChannel({ lastBuildDate: null }))).not.toContain('lastBuildDate');
  });

  test('writes no items for an empty feed', () => {
    expect(renderRss(makeChannel())).not.toContain('<item>');
  });

  test('writes each item field', () => {
    const xml = renderRss(makeChannel({ items: [makeItem()] }));

    expect(xml).toContain('<title>A video</title>');
    expect(xml).toContain('<link>https://www.youtube.com/watch?v=dQw4w9WgXcQ</link>');
    expect(xml).toContain('<guid isPermaLink="false">youtarr:video:dQw4w9WgXcQ</guid>');
    expect(xml).toContain(`<pubDate>${PUBLISHED_RFC822}</pubDate>`);
    expect(xml).toContain('<dc:creator>A channel</dc:creator>');
    expect(xml).toContain('<media:thumbnail url="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"/>');
  });

  test('accepts a date string for pubDate', () => {
    const xml = renderRss(makeChannel({ items: [makeItem({ pubDate: PUBLISHED.toISOString() })] }));

    expect(xml).toContain(`<pubDate>${PUBLISHED_RFC822}</pubDate>`);
  });

  test('entity-encodes the item HTML so it stays one text value', () => {
    const xml = renderRss(makeChannel({ items: [makeItem({ description: '<p>A & B</p>' })] }));

    expect(xml).toContain('<description>&lt;p&gt;A &amp; B&lt;/p&gt;</description>');
  });

  test('escapes a title and a URL with special characters', () => {
    const xml = renderRss(makeChannel({
      items: [makeItem({
        title: 'Rock & <Roll>',
        link: 'https://plex.example.com/?a=1&video=x',
        thumbnailUrl: 'https://img.example.com/?a=1&b="2"',
      })],
    }));

    expect(xml).toContain('<title>Rock &amp; &lt;Roll&gt;</title>');
    expect(xml).toContain('<link>https://plex.example.com/?a=1&amp;video=x</link>');
    expect(xml).toContain('<media:thumbnail url="https://img.example.com/?a=1&amp;b=&quot;2&quot;"/>');
  });

  test('keeps the order of the items it is given', () => {
    const xml = renderRss(makeChannel({
      items: [makeItem({ title: 'Newest' }), makeItem({ title: 'Older' })],
    }));

    expect(xml.indexOf('<title>Newest</title>')).toBeLessThan(xml.indexOf('<title>Older</title>'));
  });
});
