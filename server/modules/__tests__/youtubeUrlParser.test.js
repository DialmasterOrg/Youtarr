/* eslint-env jest */

const { normalizeUrlToVideoId } = require('../youtubeUrlParser');

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
