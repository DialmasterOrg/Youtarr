/* eslint-env jest */
const { renderCaps, renderError, renderSearch } = require('../newznabXml');

const item = (overrides = {}) => ({
  title: 'The.Office.US.S01E02.1080p.WEB-DL-NBC',
  guid: 'youtarr-abcdefghijk-tv',
  link: 'http://youtarr:3011/arr/newznab/nzb/The.Office.US.S01E02.1080p.WEB-DL-NBC.nzb?id=abcdefghijk&kind=tv&apikey=k',
  comments: 'https://www.youtube.com/watch?v=abcdefghijk',
  pubDate: new Date('2024-03-01T12:00:00Z'),
  kind: 'tv',
  ...overrides,
});

describe('newznabXml', () => {
  describe('renderCaps', () => {
    const caps = renderCaps();

    test('advertises title for tv-search and no ids', () => {
      expect(caps).toContain('<tv-search available="yes" supportedParams="q,title,season,ep"/>');
      expect(caps).toContain('<search available="yes" supportedParams="q"/>');
      expect(caps).toContain('<movie-search available="yes" supportedParams="q"/>');
      expect(caps).not.toMatch(/tvdbid|imdbid|tmdbid|rid|tvmazeid/);
    });

    test('does not declare a raw search engine', () => {
      expect(caps).not.toContain('searchEngine');
    });

    test('lists the categories Radarr and Sonarr test for', () => {
      expect(caps).toContain('<category id="2000" name="Movies">');
      expect(caps).toContain('<subcat id="2045" name="Movies/UHD"/>');
      expect(caps).toContain('<category id="5000" name="TV">');
      expect(caps).toContain('<subcat id="5040" name="TV/HD"/>');
    });

    test('states the paging limits', () => {
      expect(caps).toContain('<limits max="100" default="50"/>');
    });
  });

  test('renderError writes the Newznab error element', () => {
    expect(renderError(100, 'Incorrect user credentials')).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<error code="100" description="Incorrect user credentials"/>\n'
    );
  });

  test('renderError escapes the description', () => {
    expect(renderError(900, 'a "b" <c>')).toContain('description="a &quot;b&quot; &lt;c&gt;"');
  });

  describe('renderSearch', () => {
    test('writes every element Sonarr reads for an item', () => {
      const xml = renderSearch([item()]);
      expect(xml).toContain('<title>The.Office.US.S01E02.1080p.WEB-DL-NBC</title>');
      expect(xml).toContain('<guid isPermaLink="false">youtarr-abcdefghijk-tv</guid>');
      expect(xml).toContain('<comments>https://www.youtube.com/watch?v=abcdefghijk</comments>');
      expect(xml).toContain('<pubDate>Fri, 01 Mar 2024 12:00:00 GMT</pubDate>');
      expect(xml).toContain('<newznab:attr name="category" value="5000"/>');
      expect(xml).toContain('<newznab:attr name="category" value="5040"/>');
      expect(xml).toContain('<newznab:response offset="0" total="1"/>');
    });

    test('reports size 0, which skips the size checks', () => {
      const xml = renderSearch([item()]);
      expect(xml).toContain('<newznab:attr name="size" value="0"/>');
      expect(xml).toMatch(/<enclosure url="[^"]+" length="0" type="application\/x-nzb"\/>/);
    });

    test('escapes the link and uses it as the enclosure', () => {
      const xml = renderSearch([item()]);
      const escaped = 'id=abcdefghijk&amp;kind=tv&amp;apikey=k';
      expect(xml).toContain(`<link>http://youtarr:3011/arr/newznab/nzb/The.Office.US.S01E02.1080p.WEB-DL-NBC.nzb?${escaped}</link>`);
      expect(xml).toContain(`.nzb?${escaped}" length="0"`);
      expect(xml).not.toContain('kind=tv&apikey');
    });

    test('uses the movie categories for a movie', () => {
      const xml = renderSearch([item({ kind: 'movie' })]);
      expect(xml).toContain('<newznab:attr name="category" value="2000"/>');
      expect(xml).toContain('<newznab:attr name="category" value="2040"/>');
      expect(xml).not.toContain('value="5000"');
    });

    test('renders an empty page', () => {
      const xml = renderSearch([]);
      expect(xml).toContain('<newznab:response offset="0" total="0"/>');
      expect(xml).not.toContain('<item>');
      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    });
  });
});
