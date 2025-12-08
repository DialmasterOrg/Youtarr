const {
  SUBFOLDER_PREFIX,
  GLOBAL_DEFAULT_SENTINEL,
  VIDEO_EXTENSIONS,
  CHANNEL_TEMPLATE,
  VIDEO_FOLDER_TEMPLATE,
  VIDEO_FILE_TEMPLATE,
  YOUTUBE_ID_BRACKET_PATTERN,
  YOUTUBE_ID_DASH_PATTERN,
  YOUTUBE_ID_PATTERN,
  MAIN_VIDEO_FILE_PATTERN,
  FRAGMENT_FILE_PATTERN
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
    it('CHANNEL_TEMPLATE should use uploader with fallbacks', () => {
      expect(CHANNEL_TEMPLATE).toBe('%(uploader,channel,uploader_id)s');
    });

    it('VIDEO_FOLDER_TEMPLATE should include channel and truncated title', () => {
      expect(VIDEO_FOLDER_TEMPLATE).toContain(CHANNEL_TEMPLATE);
      expect(VIDEO_FOLDER_TEMPLATE).toContain('%(title).76s');
      expect(VIDEO_FOLDER_TEMPLATE).toContain('%(id)s');
    });

    it('VIDEO_FILE_TEMPLATE should include bracketed video ID', () => {
      expect(VIDEO_FILE_TEMPLATE).toContain('[%(id)s]');
      expect(VIDEO_FILE_TEMPLATE).toContain('%(ext)s');
    });
  });

  describe('YOUTUBE_ID_BRACKET_PATTERN', () => {
    it('should match [VideoID] pattern', () => {
      const match = 'Channel - Title [dQw4w9WgXcQ].mp4'.match(YOUTUBE_ID_BRACKET_PATTERN);
      expect(match).not.toBeNull();
      expect(match[1]).toBe('dQw4w9WgXcQ');
    });

    it('should match IDs with underscores and hyphens', () => {
      // YouTube IDs are exactly 11 characters
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
});
