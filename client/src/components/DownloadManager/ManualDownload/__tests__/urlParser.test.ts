import { parseYoutubeUrls } from '../urlParser';

describe('parseYoutubeUrls', () => {
  const emptySet = new Set<string>();

  describe('valid URL formats', () => {
    test('parses standard youtube.com/watch URLs', () => {
      const result = parseYoutubeUrls(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        emptySet
      );
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0]).toEqual({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        youtubeId: 'dQw4w9WgXcQ',
      });
    });

    test('parses youtu.be short URLs', () => {
      const result = parseYoutubeUrls(
        'https://youtu.be/dQw4w9WgXcQ',
        emptySet
      );
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].youtubeId).toBe('dQw4w9WgXcQ');
      expect(result.valid[0].url).toBe(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      );
    });

    test('parses youtube.com/shorts URLs', () => {
      const result = parseYoutubeUrls(
        'https://www.youtube.com/shorts/dQw4w9WgXcQ',
        emptySet
      );
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].youtubeId).toBe('dQw4w9WgXcQ');
    });

    test('parses youtube.com/embed URLs', () => {
      const result = parseYoutubeUrls(
        'https://www.youtube.com/embed/dQw4w9WgXcQ',
        emptySet
      );
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].youtubeId).toBe('dQw4w9WgXcQ');
    });

    test('parses youtube.com/live URLs', () => {
      const result = parseYoutubeUrls(
        'https://www.youtube.com/live/dQw4w9WgXcQ',
        emptySet
      );
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].youtubeId).toBe('dQw4w9WgXcQ');
    });

    test('parses m.youtube.com URLs', () => {
      const result = parseYoutubeUrls(
        'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
        emptySet
      );
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].youtubeId).toBe('dQw4w9WgXcQ');
    });

    test('parses music.youtube.com URLs', () => {
      const result = parseYoutubeUrls(
        'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
        emptySet
      );
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].youtubeId).toBe('dQw4w9WgXcQ');
    });

    test('parses URLs without www prefix', () => {
      const result = parseYoutubeUrls(
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
        emptySet
      );
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].youtubeId).toBe('dQw4w9WgXcQ');
    });

    test('parses URLs without https prefix', () => {
      const result = parseYoutubeUrls(
        'youtube.com/watch?v=dQw4w9WgXcQ',
        emptySet
      );
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].youtubeId).toBe('dQw4w9WgXcQ');
    });

    test('strips extra query params and canonicalizes URL', () => {
      const result = parseYoutubeUrls(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf&t=42s',
        emptySet
      );
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].url).toBe(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      );
    });

    test('handles youtu.be URLs with tracking params', () => {
      const result = parseYoutubeUrls(
        'https://youtu.be/dQw4w9WgXcQ?si=abc123def456',
        emptySet
      );
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].url).toBe(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      );
    });
  });

  describe('multiple URLs', () => {
    test('parses multiple URLs separated by newlines', () => {
      const input = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/jNQXAC9IVRw',
        'https://www.youtube.com/shorts/9bZkp7q19f0',
      ].join('\n');

      const result = parseYoutubeUrls(input, emptySet);
      expect(result.valid).toHaveLength(3);
      expect(result.valid.map((v) => v.youtubeId)).toEqual([
        'dQw4w9WgXcQ',
        'jNQXAC9IVRw',
        '9bZkp7q19f0',
      ]);
    });

    test('handles Windows-style line endings', () => {
      const input =
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ\r\nhttps://youtu.be/jNQXAC9IVRw';

      const result = parseYoutubeUrls(input, emptySet);
      expect(result.valid).toHaveLength(2);
    });

    test('skips blank lines', () => {
      const input =
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ\n\n\nhttps://youtu.be/jNQXAC9IVRw\n\n';

      const result = parseYoutubeUrls(input, emptySet);
      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toHaveLength(0);
    });
  });

  describe('deduplication', () => {
    test('deduplicates within batch', () => {
      const input = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
      ].join('\n');

      const result = parseYoutubeUrls(input, emptySet);
      expect(result.valid).toHaveLength(1);
      expect(result.duplicates).toHaveLength(1);
    });

    test('deduplicates against existing queue', () => {
      const existingIds = new Set(['dQw4w9WgXcQ']);
      const result = parseYoutubeUrls(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        existingIds
      );
      expect(result.valid).toHaveLength(0);
      expect(result.duplicates).toHaveLength(1);
    });

    test('deduplicates same video in different URL formats', () => {
      const input = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
        'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      ].join('\n');

      const result = parseYoutubeUrls(input, emptySet);
      expect(result.valid).toHaveLength(1);
      expect(result.duplicates).toHaveLength(2);
    });
  });

  describe('invalid lines', () => {
    test('marks non-YouTube URLs as invalid', () => {
      const result = parseYoutubeUrls('https://vimeo.com/12345', emptySet);
      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(1);
    });

    test('marks random text as invalid', () => {
      const result = parseYoutubeUrls('just some random text', emptySet);
      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(1);
    });

    test('marks YouTube channel URLs as invalid', () => {
      const result = parseYoutubeUrls(
        'https://www.youtube.com/@SomeChannel',
        emptySet
      );
      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(1);
    });
  });

  describe('playlist detection', () => {
    test('detects playlist URLs without video ID', () => {
      const result = parseYoutubeUrls(
        'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
        emptySet
      );
      expect(result.valid).toHaveLength(0);
      expect(result.playlistLines).toHaveLength(1);
    });

    test('still extracts video from URL with both video ID and list param', () => {
      const result = parseYoutubeUrls(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
        emptySet
      );
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].youtubeId).toBe('dQw4w9WgXcQ');
      expect(result.playlistLines).toHaveLength(0);
    });
  });

  describe('mixed input', () => {
    test('correctly categorizes mixed valid/invalid/duplicate/playlist lines', () => {
      const existingIds = new Set(['xXexist1ng_']);
      const input = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://www.youtube.com/watch?v=xXexist1ng_',
        'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4',
        'not a url at all',
        'https://www.youtube.com/watch?v=jNQXAC9IVRw',
        'https://youtu.be/dQw4w9WgXcQ',
      ].join('\n');

      const result = parseYoutubeUrls(input, existingIds);
      expect(result.valid).toHaveLength(2);
      expect(result.duplicates).toHaveLength(2); // xXexist1ng_ + dQw4w9WgXcQ duplicate
      expect(result.invalid).toHaveLength(1);
      expect(result.playlistLines).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    test('returns empty results for empty string', () => {
      const result = parseYoutubeUrls('', emptySet);
      expect(result.valid).toHaveLength(0);
      expect(result.duplicates).toHaveLength(0);
      expect(result.invalid).toHaveLength(0);
      expect(result.playlistLines).toHaveLength(0);
    });

    test('returns empty results for whitespace-only string', () => {
      const result = parseYoutubeUrls('   \n\n   ', emptySet);
      expect(result.valid).toHaveLength(0);
    });

    test('handles URLs with leading/trailing whitespace', () => {
      const result = parseYoutubeUrls(
        '   https://www.youtube.com/watch?v=dQw4w9WgXcQ   ',
        emptySet
      );
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].youtubeId).toBe('dQw4w9WgXcQ');
    });

    test('handles video IDs with hyphens and underscores', () => {
      const result = parseYoutubeUrls(
        'https://www.youtube.com/watch?v=a-b_c1D2E3F',
        emptySet
      );
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].youtubeId).toBe('a-b_c1D2E3F');
    });

    test('rejects video IDs that are too short', () => {
      const result = parseYoutubeUrls(
        'https://www.youtube.com/watch?v=tooshort',
        emptySet
      );
      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(1);
    });

    test('rejects video IDs that are too long', () => {
      const result = parseYoutubeUrls(
        'https://www.youtube.com/watch?v=toolongvideoid',
        emptySet
      );
      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(1);
    });
  });
});
