const BaseAdapter = require('../baseAdapter');
const {
  extractBasename,
  pathSegments,
  trailingSegmentMatch,
  isServerUnavailableError,
  describeHttpError,
  MediaServerUnavailableError,
} = require('../baseAdapter');

describe('BaseAdapter.resolveItemIdsByFilepaths (default batch)', () => {
  class PerFileAdapter extends BaseAdapter {
    async resolveItemIdByFilepath(filepath) {
      return filepath === '/a/found.mp4' ? 'item-1' : null;
    }
  }

  test('resolves each path via the per-file method and maps misses to null', async () => {
    const adapter = new PerFileAdapter({});
    const resolved = await adapter.resolveItemIdsByFilepaths(['/a/found.mp4', '/b/missing.mp4']);
    expect(resolved.get('/a/found.mp4')).toBe('item-1');
    expect(resolved.get('/b/missing.mp4')).toBeNull();
    expect(resolved.size).toBe(2);
  });

  test('returns an empty map for an empty or missing batch', async () => {
    const adapter = new PerFileAdapter({});
    expect((await adapter.resolveItemIdsByFilepaths([])).size).toBe(0);
    expect((await adapter.resolveItemIdsByFilepaths(undefined)).size).toBe(0);
  });
});

describe('baseAdapter helpers', () => {
  describe('extractBasename', () => {
    test('returns the filename from a POSIX path', () => {
      expect(extractBasename('/a/b/c/file [id].mp4')).toBe('file [id].mp4');
    });

    test('returns the filename from a Windows path', () => {
      expect(extractBasename('Q:\\Media\\Channel\\file [id].mp4')).toBe('file [id].mp4');
    });

    test('returns empty string for falsy input', () => {
      expect(extractBasename('')).toBe('');
      expect(extractBasename(null)).toBe('');
    });
  });

  describe('pathSegments', () => {
    test('splits on both separators and drops empties', () => {
      expect(pathSegments('/a/b//c')).toEqual(['a', 'b', 'c']);
      expect(pathSegments('Q:\\a\\b\\c')).toEqual(['Q:', 'a', 'b', 'c']);
    });

    test('returns an empty array for falsy input', () => {
      expect(pathSegments(null)).toEqual([]);
      expect(pathSegments('')).toEqual([]);
    });
  });

  describe('trailingSegmentMatch', () => {
    test('counts shared trailing segments, ignoring differing prefixes (mount roots)', () => {
      const target = pathSegments('/usr/src/app/data/__Library2/Little Mix/VF/clip [id].mp4');
      const plex = pathSegments('Q:\\YT\\__Library2\\Little Mix\\VF\\clip [id].mp4');
      // file, VF, Little Mix, __Library2 all match from the end; then YT vs data differ.
      expect(trailingSegmentMatch(target, plex)).toBe(4);
    });

    test('a stale item in a different subfolder scores lower than the current one', () => {
      const target = pathSegments('/data/__Library2/Little Mix/VF/clip [id].mp4');
      const stale = pathSegments('Q:\\YT\\__GlobalDefault\\Little Mix\\VF\\clip [id].mp4');
      const current = pathSegments('Q:\\YT\\__Library2\\Little Mix\\VF\\clip [id].mp4');
      expect(trailingSegmentMatch(target, stale)).toBe(3); // diverges at the subfolder
      expect(trailingSegmentMatch(target, current)).toBe(4);
      expect(trailingSegmentMatch(target, current)).toBeGreaterThan(
        trailingSegmentMatch(target, stale)
      );
    });

    test('returns 0 when nothing matches', () => {
      expect(trailingSegmentMatch(['a', 'b'], ['c', 'd'])).toBe(0);
    });

    test('handles empty inputs', () => {
      expect(trailingSegmentMatch([], ['a'])).toBe(0);
      expect(trailingSegmentMatch(['a'], [])).toBe(0);
    });
  });

  describe('isServerUnavailableError', () => {
    test('true for an axios error with no response (connection refused / timeout)', () => {
      expect(isServerUnavailableError({ isAxiosError: true, code: 'ECONNREFUSED' })).toBe(true);
    });

    test('true for an axios 5xx (e.g. Jellyfin "loading" 503)', () => {
      expect(isServerUnavailableError({ isAxiosError: true, response: { status: 503 } })).toBe(true);
    });

    test('false for an axios 4xx', () => {
      expect(isServerUnavailableError({ isAxiosError: true, response: { status: 404 } })).toBe(false);
    });

    test('false for a non-axios error', () => {
      expect(isServerUnavailableError(new Error('boom'))).toBe(false);
      expect(isServerUnavailableError(null)).toBe(false);
    });
  });

  describe('describeHttpError', () => {
    test('keeps status/code/message and drops config/request/response (no token leak)', () => {
      const err = {
        isAxiosError: true,
        code: 'ERR_BAD_RESPONSE',
        message: 'Request failed with status code 503',
        response: { status: 503, data: 'loading' },
        config: { headers: { 'X-Emby-Token': 'SECRET' } },
        request: { _header: 'GET /Items ... X-Emby-Token: SECRET' },
      };
      const out = describeHttpError(err);
      expect(out).toEqual({ status: 503, code: 'ERR_BAD_RESPONSE', message: 'Request failed with status code 503' });
      expect(JSON.stringify(out)).not.toContain('SECRET');
    });

    test('handles a falsy error', () => {
      expect(describeHttpError(null)).toEqual({ message: 'unknown error' });
    });
  });

  describe('MediaServerUnavailableError', () => {
    test('carries status and code and is an Error', () => {
      const e = new MediaServerUnavailableError({ status: 503, code: 'X', message: 'm' });
      expect(e).toBeInstanceOf(Error);
      expect(e.status).toBe(503);
      expect(e.code).toBe('X');
      expect(e.message).toBe('m');
    });
  });
});
