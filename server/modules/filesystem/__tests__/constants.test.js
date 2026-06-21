const {
  SUBFOLDER_PREFIX,
  GLOBAL_DEFAULT_SENTINEL,
  VIDEO_EXTENSIONS,
  CHANNEL_TEMPLATE,
  YOUTUBE_ID_BRACKET_PATTERN,
  YOUTUBE_ID_DASH_PATTERN,
  YOUTUBE_ID_PATTERN,
  MAIN_VIDEO_FILE_PATTERN,
  FRAGMENT_FILE_PATTERN,
  CHANNEL_CLEANUP_IGNORABLE_FILES
} = require('../constants');

describe('filesystem/constants', () => {
  describe('SUBFOLDER_PREFIX', () => {
    it('should be __', () => {
      expect(SUBFOLDER_PREFIX).toBe('__');
    });
  });

  describe('GLOBAL_DEFAULT_SENTINEL', () => {
    it('should be ##USE_GLOBAL_DEFAULT##', () => {
      expect(GLOBAL_DEFAULT_SENTINEL).toBe('##USE_GLOBAL_DEFAULT##');
    });
  });

  describe('VIDEO_EXTENSIONS', () => {
    it('should contain common video extensions', () => {
      expect(VIDEO_EXTENSIONS).toContain('.mp4');
      expect(VIDEO_EXTENSIONS).toContain('.webm');
      expect(VIDEO_EXTENSIONS).toContain('.mkv');
      expect(VIDEO_EXTENSIONS).toContain('.m4v');
      expect(VIDEO_EXTENSIONS).toContain('.avi');
    });

    it('should have .mp4 as highest priority', () => {
      expect(VIDEO_EXTENSIONS[0]).toBe('.mp4');
    });
  });

  describe('yt-dlp templates', () => {
    it('CHANNEL_TEMPLATE should use uploader with fallbacks and byte truncation', () => {
      expect(CHANNEL_TEMPLATE).toBe('%(uploader,channel,uploader_id).80B');
    });
  });

  describe('YOUTUBE_ID_BRACKET_PATTERN', () => {
    it('should match [VideoID] pattern', () => {
      const match = 'Channel - Title [dQw4w9WgXcQ].mp4'.match(YOUTUBE_ID_BRACKET_PATTERN);
      expect(match).not.toBeNull();
      expect(match[1]).toBe('dQw4w9WgXcQ');
    });

    it('should match IDs with underscores and hyphens', () => {
      // This parser accepts the same defensive 10-12 character window as YOUTUBE_ID_PATTERN.
      const match = 'Video [a_b-c_d-e_f].mp4'.match(YOUTUBE_ID_BRACKET_PATTERN);
      expect(match).not.toBeNull();
      expect(match[1]).toBe('a_b-c_d-e_f');
    });

    it('should not match without brackets', () => {
      const match = 'Channel - Title dQw4w9WgXcQ.mp4'.match(YOUTUBE_ID_BRACKET_PATTERN);
      expect(match).toBeNull();
    });
  });

  describe('YOUTUBE_ID_DASH_PATTERN', () => {
    it('should match " - VideoID" at end of string', () => {
      const match = 'Channel - Title - dQw4w9WgXcQ'.match(YOUTUBE_ID_DASH_PATTERN);
      expect(match).not.toBeNull();
      expect(match[1]).toBe('dQw4w9WgXcQ');
    });

    it('should not match in middle of string', () => {
      const match = 'Channel - dQw4w9WgXcQ - Title'.match(YOUTUBE_ID_DASH_PATTERN);
      expect(match).toBeNull();
    });
  });

  describe('YOUTUBE_ID_PATTERN', () => {
    it('should validate 11-character YouTube IDs', () => {
      expect(YOUTUBE_ID_PATTERN.test('dQw4w9WgXcQ')).toBe(true);
    });

    it('should validate 10-12 character IDs', () => {
      expect(YOUTUBE_ID_PATTERN.test('abcdefghij')).toBe(true);
      expect(YOUTUBE_ID_PATTERN.test('abcdefghijk')).toBe(true);
      expect(YOUTUBE_ID_PATTERN.test('abcdefghijkl')).toBe(true);
    });

    it('should allow hyphens and underscores', () => {
      expect(YOUTUBE_ID_PATTERN.test('a-b_c-d_e-f')).toBe(true);
    });

    it('should reject too short IDs', () => {
      expect(YOUTUBE_ID_PATTERN.test('abc')).toBe(false);
    });

    it('should reject too long IDs', () => {
      expect(YOUTUBE_ID_PATTERN.test('abcdefghijklm')).toBe(false);
    });
  });

  describe('MAIN_VIDEO_FILE_PATTERN', () => {
    it('should match main video files', () => {
      expect(MAIN_VIDEO_FILE_PATTERN.test('Channel - Title [dQw4w9WgXcQ].mp4')).toBe(true);
      expect(MAIN_VIDEO_FILE_PATTERN.test('Channel - Title [dQw4w9WgXcQ].mkv')).toBe(true);
      expect(MAIN_VIDEO_FILE_PATTERN.test('Channel - Title [dQw4w9WgXcQ].webm')).toBe(true);
    });

    it('should not match thumbnails', () => {
      expect(MAIN_VIDEO_FILE_PATTERN.test('poster.jpg')).toBe(false);
    });
  });

  describe('FRAGMENT_FILE_PATTERN', () => {
    it('should match fragment files', () => {
      expect(FRAGMENT_FILE_PATTERN.test('video.f137.mp4')).toBe(true);
      expect(FRAGMENT_FILE_PATTERN.test('video.f140.m4a')).toBe(true);
      expect(FRAGMENT_FILE_PATTERN.test('video.f248.webm')).toBe(true);
    });

    it('should not match main video files', () => {
      expect(FRAGMENT_FILE_PATTERN.test('Channel - Title [dQw4w9WgXcQ].mp4')).toBe(false);
    });
  });

  describe('CHANNEL_CLEANUP_IGNORABLE_FILES', () => {
    it('should exist and be an array', () => {
      expect(Array.isArray(CHANNEL_CLEANUP_IGNORABLE_FILES)).toBe(true);
    });

    it('should contain poster.jpg', () => {
      expect(CHANNEL_CLEANUP_IGNORABLE_FILES).toContain('poster.jpg');
    });

    it('should contain alternate poster formats', () => {
      expect(CHANNEL_CLEANUP_IGNORABLE_FILES).toContain('poster.png');
      expect(CHANNEL_CLEANUP_IGNORABLE_FILES).toContain('poster.jpeg');
    });

    it('should contain OS metadata files', () => {
      expect(CHANNEL_CLEANUP_IGNORABLE_FILES).toContain('.ds_store');
      expect(CHANNEL_CLEANUP_IGNORABLE_FILES).toContain('thumbs.db');
      expect(CHANNEL_CLEANUP_IGNORABLE_FILES).toContain('desktop.ini');
    });
  });

  const {
    DEFAULT_VIDEO_FILENAME_PREFIX,
    VIDEO_FILENAME_SUFFIX,
    composeVideoFileTemplate,
    composeThumbnailFilename,
    composeVideoFolderName,
  } = require('../constants');

  describe('DEFAULT_VIDEO_FILENAME_PREFIX', () => {
    it('matches the legacy file template prefix exactly', () => {
      expect(DEFAULT_VIDEO_FILENAME_PREFIX).toBe('%(uploader,channel,uploader_id).80B - %(title).76B');
    });
  });

  describe('VIDEO_FILENAME_SUFFIX', () => {
    it('is the locked id+ext suffix', () => {
      expect(VIDEO_FILENAME_SUFFIX).toBe('[%(id)s].%(ext)s');
    });
  });

  describe('composeVideoFileTemplate', () => {
    it('produces the legacy template when given the default prefix', () => {
      expect(composeVideoFileTemplate(DEFAULT_VIDEO_FILENAME_PREFIX))
        .toBe('%(uploader,channel,uploader_id).80B - %(title).76B [%(id)s].%(ext)s');
    });

    it('inserts a single space between non-empty prefix and suffix', () => {
      expect(composeVideoFileTemplate('%(title)s'))
        .toBe('%(title)s [%(id)s].%(ext)s');
    });

    it('omits the leading space when the prefix is empty as defensive fallback behavior', () => {
      expect(composeVideoFileTemplate('')).toBe('[%(id)s].%(ext)s');
    });

    it('treats whitespace-only prefix as empty as defensive fallback behavior', () => {
      expect(composeVideoFileTemplate('   ')).toBe('[%(id)s].%(ext)s');
    });

    it('falls back to default when prefix is null or undefined', () => {
      expect(composeVideoFileTemplate(null))
        .toBe('%(uploader,channel,uploader_id).80B - %(title).76B [%(id)s].%(ext)s');
      expect(composeVideoFileTemplate(undefined))
        .toBe('%(uploader,channel,uploader_id).80B - %(title).76B [%(id)s].%(ext)s');
    });
  });

  describe('composeThumbnailFilename', () => {
    it('produces the legacy thumbnail template when given the default prefix', () => {
      expect(composeThumbnailFilename(DEFAULT_VIDEO_FILENAME_PREFIX))
        .toBe('%(uploader,channel,uploader_id).80B - %(title).76B [%(id)s]');
    });

    it('drops the .%(ext)s tail relative to the file template', () => {
      expect(composeThumbnailFilename('%(title)s')).toBe('%(title)s [%(id)s]');
    });

    it('omits the leading space when the prefix is empty as defensive fallback behavior', () => {
      expect(composeThumbnailFilename('')).toBe('[%(id)s]');
    });
  });

  describe('composeVideoFolderName', () => {
    it('produces the legacy folder template when given the default prefix', () => {
      expect(composeVideoFolderName(DEFAULT_VIDEO_FILENAME_PREFIX))
        .toBe('%(uploader,channel,uploader_id).80B - %(title).76B - %(id)s');
    });

    it('inserts " - " between non-empty prefix and id', () => {
      expect(composeVideoFolderName('%(title)s')).toBe('%(title)s - %(id)s');
    });

    it('omits the leading " - " when the prefix is empty as defensive fallback behavior', () => {
      expect(composeVideoFolderName('')).toBe('%(id)s');
    });

    it('treats whitespace-only prefix as empty as defensive fallback behavior', () => {
      expect(composeVideoFolderName('   ')).toBe('%(id)s');
    });

    it('falls back to default when prefix is null or undefined', () => {
      expect(composeVideoFolderName(null))
        .toBe('%(uploader,channel,uploader_id).80B - %(title).76B - %(id)s');
      expect(composeVideoFolderName(undefined))
        .toBe('%(uploader,channel,uploader_id).80B - %(title).76B - %(id)s');
    });
  });
});
