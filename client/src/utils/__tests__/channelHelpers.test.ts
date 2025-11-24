import {
  normalizeChannelUrl,
  channelMatchesFilter,
  normalizeSubFolderKey,
  formatSubFolderLabel,
  DEFAULT_SUBFOLDER_KEY,
} from '../channelHelpers';

describe('channelHelpers Utility', () => {
  describe('normalizeChannelUrl', () => {
    describe('handle (@username) URLs', () => {
      test('normalizes @username to full YouTube URL', () => {
        expect(normalizeChannelUrl('@testuser')).toBe('https://www.youtube.com/@testuser');
      });

      test('normalizes username without @ to full YouTube URL with @', () => {
        expect(normalizeChannelUrl('testuser')).toBe('https://www.youtube.com/@testuser');
      });

      test('accepts handles with hyphens', () => {
        expect(normalizeChannelUrl('@test-user-name')).toBe('https://www.youtube.com/@test-user-name');
      });

      test('extracts handle from full YouTube URL with @', () => {
        expect(normalizeChannelUrl('https://www.youtube.com/@testuser')).toBe('https://www.youtube.com/@testuser');
      });

      test('extracts handle from YouTube URL with trailing path', () => {
        expect(normalizeChannelUrl('https://www.youtube.com/@testuser/videos')).toBe('https://www.youtube.com/@testuser');
      });

      test('extracts handle from URL without protocol', () => {
        expect(normalizeChannelUrl('youtube.com/@testuser')).toBe('https://www.youtube.com/@testuser');
      });

      test('handles www prefix in URL', () => {
        expect(normalizeChannelUrl('www.youtube.com/@testuser')).toBe('https://www.youtube.com/@testuser');
      });

      test('extracts handle with dots from full URL', () => {
        expect(normalizeChannelUrl('https://www.youtube.com/@test.user')).toBe('https://www.youtube.com/@test.user');
      });
    });

    describe('legacy channel URLs', () => {
      test('normalizes /c/ channel URLs', () => {
        expect(normalizeChannelUrl('https://www.youtube.com/c/channelname')).toBe('https://www.youtube.com/c/channelname');
      });

      test('normalizes /channel/ URLs', () => {
        expect(normalizeChannelUrl('https://www.youtube.com/channel/UCxxxxxx')).toBe('https://www.youtube.com/channel/UCxxxxxx');
      });

      test('strips trailing paths from /c/ URLs', () => {
        expect(normalizeChannelUrl('https://www.youtube.com/c/channelname/videos')).toBe('https://www.youtube.com/c/channelname');
      });

      test('strips trailing paths from /channel/ URLs', () => {
        expect(normalizeChannelUrl('https://www.youtube.com/channel/UCxxxxxx/about')).toBe('https://www.youtube.com/channel/UCxxxxxx');
      });
    });

    describe('URL normalization', () => {
      test('adds https:// to URLs without protocol', () => {
        expect(normalizeChannelUrl('youtube.com/@testuser')).toBe('https://www.youtube.com/@testuser');
      });

      test('strips trailing slashes', () => {
        expect(normalizeChannelUrl('https://www.youtube.com/@testuser/')).toBe('https://www.youtube.com/@testuser');
      });

      test('strips multiple trailing slashes', () => {
        expect(normalizeChannelUrl('https://www.youtube.com/@testuser///')).toBe('https://www.youtube.com/@testuser');
      });

      test('trims whitespace', () => {
        expect(normalizeChannelUrl('  @testuser  ')).toBe('https://www.youtube.com/@testuser');
      });

      test('handles http:// protocol', () => {
        expect(normalizeChannelUrl('http://www.youtube.com/@testuser')).toBe('https://www.youtube.com/@testuser');
      });
    });

    describe('youtu.be short URLs', () => {
      test('accepts youtu.be domain for handles', () => {
        expect(normalizeChannelUrl('https://youtu.be/@testuser')).toBe('https://www.youtube.com/@testuser');
      });
    });

    describe('invalid inputs', () => {
      test('returns null for empty string', () => {
        expect(normalizeChannelUrl('')).toBeNull();
      });

      test('returns null for whitespace-only string', () => {
        expect(normalizeChannelUrl('   ')).toBeNull();
      });

      test('returns null for non-YouTube URLs', () => {
        expect(normalizeChannelUrl('https://www.vimeo.com/@testuser')).toBeNull();
      });

      test('returns null for invalid YouTube paths', () => {
        expect(normalizeChannelUrl('https://www.youtube.com/watch?v=12345')).toBeNull();
      });

      test('returns null for YouTube home page', () => {
        expect(normalizeChannelUrl('https://www.youtube.com')).toBeNull();
      });

      test('returns null for invalid handle with special characters', () => {
        expect(normalizeChannelUrl('@test user!')).toBeNull();
      });

      test('returns null for malformed URLs', () => {
        expect(normalizeChannelUrl('not a url')).toBeNull();
      });
    });

    describe('edge cases', () => {
      test('handles case-insensitive domain matching', () => {
        expect(normalizeChannelUrl('https://WWW.YOUTUBE.COM/@testuser')).toBe('https://www.youtube.com/@testuser');
      });

      test('handles mixed case in path', () => {
        expect(normalizeChannelUrl('https://www.youtube.com/@TestUser')).toBe('https://www.youtube.com/@TestUser');
      });

      test('handles URL with query parameters', () => {
        expect(normalizeChannelUrl('https://www.youtube.com/@testuser?feature=share')).toBe('https://www.youtube.com/@testuser');
      });
    });
  });

  describe('channelMatchesFilter', () => {
    test('returns true when filter is empty string', () => {
      expect(channelMatchesFilter('Test Channel', 'https://youtube.com/@test', '')).toBe(true);
    });

    test('returns true when filter is whitespace only', () => {
      expect(channelMatchesFilter('Test Channel', 'https://youtube.com/@test', '   ')).toBe(true);
    });

    test('matches channel name case-insensitively', () => {
      expect(channelMatchesFilter('Test Channel', 'https://youtube.com/@test', 'test')).toBe(true);
    });

    test('matches channel name with uppercase filter', () => {
      expect(channelMatchesFilter('Test Channel', 'https://youtube.com/@test', 'TEST')).toBe(true);
    });

    test('matches channel URL case-insensitively', () => {
      expect(channelMatchesFilter('My Channel', 'https://youtube.com/@mychannel', 'MYCHANNEL')).toBe(true);
    });

    test('matches partial channel name', () => {
      expect(channelMatchesFilter('The Best Channel', 'https://youtube.com/@best', 'best')).toBe(true);
    });

    test('matches partial URL', () => {
      expect(channelMatchesFilter('My Channel', 'https://youtube.com/@unique123', '123')).toBe(true);
    });

    test('trims filter whitespace before matching', () => {
      expect(channelMatchesFilter('Test Channel', 'https://youtube.com/@test', '  test  ')).toBe(true);
    });

    test('returns false when no match in name or URL', () => {
      expect(channelMatchesFilter('Test Channel', 'https://youtube.com/@test', 'nomatch')).toBe(false);
    });

    test('returns true when filter matches both name and URL', () => {
      expect(channelMatchesFilter('Test Channel', 'https://youtube.com/@test', 'test')).toBe(true);
    });

    test('returns true when filter matches name but not URL', () => {
      expect(channelMatchesFilter('Gaming Channel', 'https://youtube.com/@xyz', 'gaming')).toBe(true);
    });

    test('returns true when filter matches URL but not name', () => {
      expect(channelMatchesFilter('My Channel', 'https://youtube.com/@gaming123', 'gaming')).toBe(true);
    });
  });

  describe('normalizeSubFolderKey', () => {
    test('returns DEFAULT_SUBFOLDER_KEY for undefined', () => {
      expect(normalizeSubFolderKey(undefined)).toBe(DEFAULT_SUBFOLDER_KEY);
    });

    test('returns DEFAULT_SUBFOLDER_KEY for null', () => {
      expect(normalizeSubFolderKey(null)).toBe(DEFAULT_SUBFOLDER_KEY);
    });

    test('returns DEFAULT_SUBFOLDER_KEY for empty string', () => {
      expect(normalizeSubFolderKey('')).toBe(DEFAULT_SUBFOLDER_KEY);
    });

    test('returns the value when it is a non-empty string', () => {
      expect(normalizeSubFolderKey('custom')).toBe('custom');
    });

    test('returns the value with spaces preserved', () => {
      expect(normalizeSubFolderKey('my folder')).toBe('my folder');
    });

    test('returns the value with special characters', () => {
      expect(normalizeSubFolderKey('folder-123_test')).toBe('folder-123_test');
    });
  });

  describe('formatSubFolderLabel', () => {
    test('returns "default" for DEFAULT_SUBFOLDER_KEY', () => {
      expect(formatSubFolderLabel(DEFAULT_SUBFOLDER_KEY)).toBe('default');
    });

    test('formats custom key with __ prefix and / suffix', () => {
      expect(formatSubFolderLabel('custom')).toBe('__custom/');
    });

    test('formats key with spaces', () => {
      expect(formatSubFolderLabel('my folder')).toBe('__my folder/');
    });

    test('formats key with special characters', () => {
      expect(formatSubFolderLabel('folder-123_test')).toBe('__folder-123_test/');
    });

    test('does not double-prefix keys that already have underscores', () => {
      expect(formatSubFolderLabel('_existing')).toBe('___existing/');
    });
  });

  describe('DEFAULT_SUBFOLDER_KEY constant', () => {
    test('has expected value', () => {
      expect(DEFAULT_SUBFOLDER_KEY).toBe('__default__');
    });
  });

  describe('Integration: normalizeSubFolderKey and formatSubFolderLabel', () => {
    test('null value normalizes and formats to "default"', () => {
      const normalized = normalizeSubFolderKey(null);
      const formatted = formatSubFolderLabel(normalized);
      expect(formatted).toBe('default');
    });

    test('undefined value normalizes and formats to "default"', () => {
      const normalized = normalizeSubFolderKey(undefined);
      const formatted = formatSubFolderLabel(normalized);
      expect(formatted).toBe('default');
    });

    test('empty string normalizes and formats to "default"', () => {
      const normalized = normalizeSubFolderKey('');
      const formatted = formatSubFolderLabel(normalized);
      expect(formatted).toBe('default');
    });

    test('custom value normalizes and formats correctly', () => {
      const normalized = normalizeSubFolderKey('videos');
      const formatted = formatSubFolderLabel(normalized);
      expect(formatted).toBe('__videos/');
    });
  });
});
