/* eslint-env jest */

const { normalizeUrlToVideoId, toYoutubeUrl } = require('../youtubeUrlParser');

describe('youtubeUrlParser.normalizeUrlToVideoId', () => {
  it('extracts the id from a standard watch URL', () => {
    const result = normalizeUrlToVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result).toEqual({
      id: 'dQw4w9WgXcQ',
      canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
  });

  it('extracts the id from youtu.be, shorts, embed, and live URLs', () => {
    const urls = [
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
    ];
    for (const url of urls) {
      expect(normalizeUrlToVideoId(url).id).toBe('dQw4w9WgXcQ');
    }
  });

  it('adds https:// when the scheme is missing', () => {
    expect(normalizeUrlToVideoId('youtube.com/watch?v=dQw4w9WgXcQ').id).toBe('dQw4w9WgXcQ');
  });

  it('throws on a non-YouTube or malformed URL', () => {
    expect(() => normalizeUrlToVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toThrow('Invalid YouTube URL format');
    expect(() => normalizeUrlToVideoId('not a url at all !!!')).toThrow();
    expect(() => normalizeUrlToVideoId(null)).toThrow('Invalid URL provided');
  });
});

describe('youtubeUrlParser.toYoutubeUrl', () => {
  it('returns the URL for youtube.com, its www, m and music hosts, and youtu.be', () => {
    expect(toYoutubeUrl('https://youtube.com/@handle')).toBe('https://youtube.com/@handle');
    expect(toYoutubeUrl('https://www.youtube.com/@handle')).toBe('https://www.youtube.com/@handle');
    expect(toYoutubeUrl('https://m.youtube.com/@handle')).toBe('https://m.youtube.com/@handle');
    expect(toYoutubeUrl('https://music.youtube.com/playlist?list=PL1')).toBe('https://music.youtube.com/playlist?list=PL1');
    expect(toYoutubeUrl('http://youtu.be/dQw4w9WgXcQ')).toBe('http://youtu.be/dQw4w9WgXcQ');
  });

  it('adds https:// when the scheme is missing', () => {
    expect(toYoutubeUrl(' youtube.com/@handle ')).toBe('https://youtube.com/@handle');
  });

  it('drops a trailing dot from the host', () => {
    expect(toYoutubeUrl('https://www.youtube.com./@handle')).toBe('https://www.youtube.com/@handle');
  });

  it('returns the parsed form of a URL other parsers read as another host', () => {
    expect(toYoutubeUrl('https://www.youtube.com\\@127.0.0.1:9911/')).toBe('https://www.youtube.com/@127.0.0.1:9911/');
  });

  it('returns null for other youtube.com subdomains, which yt-dlp can be redirected from', () => {
    expect(toYoutubeUrl('https://consent.youtube.com/m?continue=http%3A%2F%2F127.0.0.1%3A9911%2Fprobe')).toBeNull();
    expect(toYoutubeUrl('consent.youtube.com/m?continue=http://127.0.0.1:9911/probe')).toBeNull();
    expect(toYoutubeUrl('https://studio.youtube.com/channel/UC123')).toBeNull();
    expect(toYoutubeUrl('https://a.www.youtube.com/@handle')).toBeNull();
  });

  it('returns null for other hosts, lookalikes and internal addresses', () => {
    const rejected = [
      'http://127.0.0.1:9911/probe',
      '127.0.0.1:9911/probe',
      'http://169.254.169.254/latest/meta-data',
      'https://example.com/@handle',
      'https://youtube.com.evil.example/@handle',
      'https://evilyoutube.com/@handle',
      'https://youtube.com@evil.example/@handle',
    ];
    for (const url of rejected) {
      expect(toYoutubeUrl(url)).toBeNull();
    }
  });

  it('returns null for other schemes and non-string input', () => {
    expect(toYoutubeUrl('file:///etc/passwd')).toBeNull();
    expect(toYoutubeUrl('ftp://youtube.com/x')).toBeNull();
    expect(toYoutubeUrl('')).toBeNull();
    expect(toYoutubeUrl(null)).toBeNull();
    expect(toYoutubeUrl({})).toBeNull();
  });
});
