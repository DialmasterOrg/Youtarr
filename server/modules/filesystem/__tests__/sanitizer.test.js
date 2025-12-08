const {
  sanitizePathLikeYtDlp,
  sanitizeNameLikeYtDlp,
  sanitizePathParts
} = require('../sanitizer');

describe('sanitizer', () => {
  describe('sanitizePathParts', () => {
    it('should skip empty parts', () => {
      expect(sanitizePathParts(['', 'a', '', 'b', ''])).toEqual(['a', 'b']);
    });

    it('should skip single dots', () => {
      expect(sanitizePathParts(['.', 'a', '.', 'b'])).toEqual(['a', 'b']);
    });

    it('should handle parent directory references', () => {
      expect(sanitizePathParts(['a', 'b', '..', 'c'])).toEqual(['a', 'c']);
      expect(sanitizePathParts(['a', '..', '..', 'b'])).toEqual(['..', 'b']);
      expect(sanitizePathParts(['..', 'a'])).toEqual(['..', 'a']);
    });

    it('should replace Windows-forbidden characters with #', () => {
      expect(sanitizePathParts(['file<name'])).toEqual(['file#name']);
      expect(sanitizePathParts(['file>name'])).toEqual(['file#name']);
      expect(sanitizePathParts(['file:name'])).toEqual(['file#name']);
      expect(sanitizePathParts(['file"name'])).toEqual(['file#name']);
      expect(sanitizePathParts(['file|name'])).toEqual(['file#name']);
      expect(sanitizePathParts(['file?name'])).toEqual(['file#name']);
      expect(sanitizePathParts(['file*name'])).toEqual(['file#name']);
      expect(sanitizePathParts(['file\\name'])).toEqual(['file#name']);
      expect(sanitizePathParts(['file/name'])).toEqual(['file#name']);
    });

    it('should replace multiple forbidden characters', () => {
      expect(sanitizePathParts(['file<>:name'])).toEqual(['file###name']);
    });

    it('should replace trailing dots with #', () => {
      expect(sanitizePathParts(['filename.'])).toEqual(['filename#']);
      expect(sanitizePathParts(['filename..'])).toEqual(['filename.#']);
      expect(sanitizePathParts(['filename...'])).toEqual(['filename..#']);
    });

    it('should replace trailing spaces with #', () => {
      expect(sanitizePathParts(['filename '])).toEqual(['filename#']);
      expect(sanitizePathParts(['filename  '])).toEqual(['filename #']);
    });

    it('should replace trailing whitespace and dots', () => {
      expect(sanitizePathParts(['filename. '])).toEqual(['filename.#']);
      expect(sanitizePathParts(['filename .'])).toEqual(['filename #']);
    });
  });

  describe('sanitizePathLikeYtDlp', () => {
    it('should return "." for empty input', () => {
      expect(sanitizePathLikeYtDlp('')).toBe('.');
      expect(sanitizePathLikeYtDlp(null)).toBe('.');
      expect(sanitizePathLikeYtDlp(undefined)).toBe('.');
    });

    it('should preserve leading slash for absolute paths', () => {
      expect(sanitizePathLikeYtDlp('/home/user/file')).toBe('/home/user/file');
      expect(sanitizePathLikeYtDlp('/a/b/c')).toBe('/a/b/c');
    });

    it('should handle relative paths', () => {
      expect(sanitizePathLikeYtDlp('home/user/file')).toBe('home/user/file');
      expect(sanitizePathLikeYtDlp('a/b/c')).toBe('a/b/c');
    });

    it('should sanitize Windows-forbidden characters in path', () => {
      // Both < and > are forbidden chars, so both get replaced
      expect(sanitizePathLikeYtDlp('/path/to/file<name>/test')).toBe('/path/to/file#name#/test');
      expect(sanitizePathLikeYtDlp('/path/file:name')).toBe('/path/file#name');
      // Single forbidden char
      expect(sanitizePathLikeYtDlp('/path/to/file<test/file')).toBe('/path/to/file#test/file');
    });

    it('should handle trailing dots in path segments', () => {
      expect(sanitizePathLikeYtDlp('/path./to./file.')).toBe('/path#/to#/file#');
    });

    it('should normalize empty segments and dots', () => {
      expect(sanitizePathLikeYtDlp('/path//to/./file')).toBe('/path/to/file');
    });

    it('should handle parent directory references', () => {
      expect(sanitizePathLikeYtDlp('/path/to/../file')).toBe('/path/file');
    });

    it('should handle real-world video paths with special chars', () => {
      // Video title with colon
      expect(sanitizePathLikeYtDlp('/videos/Channel/Video: The Title [abc123]'))
        .toBe('/videos/Channel/Video# The Title [abc123]');

      // Video title with question mark
      expect(sanitizePathLikeYtDlp('/videos/Channel/What is this? [abc123]'))
        .toBe('/videos/Channel/What is this# [abc123]');

      // Video title with multiple special chars
      expect(sanitizePathLikeYtDlp('/videos/Channel/Best <Video> Ever! [abc123]'))
        .toBe('/videos/Channel/Best #Video# Ever! [abc123]');
    });

    it('should handle channel names with trailing dots', () => {
      expect(sanitizePathLikeYtDlp('/videos/Channel Inc./video'))
        .toBe('/videos/Channel Inc#/video');
    });
  });

  describe('sanitizeNameLikeYtDlp', () => {
    it('should return "_" for empty input', () => {
      expect(sanitizeNameLikeYtDlp('')).toBe('_');
      expect(sanitizeNameLikeYtDlp(null)).toBe('_');
      expect(sanitizeNameLikeYtDlp(undefined)).toBe('_');
    });

    it('should replace Windows-forbidden characters', () => {
      expect(sanitizeNameLikeYtDlp('file<name')).toBe('file#name');
      expect(sanitizeNameLikeYtDlp('file>name')).toBe('file#name');
      expect(sanitizeNameLikeYtDlp('file:name')).toBe('file#name');
      expect(sanitizeNameLikeYtDlp('file"name')).toBe('file#name');
      expect(sanitizeNameLikeYtDlp('file|name')).toBe('file#name');
      expect(sanitizeNameLikeYtDlp('file?name')).toBe('file#name');
      expect(sanitizeNameLikeYtDlp('file*name')).toBe('file#name');
    });

    it('should replace only the last trailing dot', () => {
      // yt-dlp only replaces a SINGLE trailing char, not all of them
      expect(sanitizeNameLikeYtDlp('filename.')).toBe('filename#');
      expect(sanitizeNameLikeYtDlp('filename..')).toBe('filename.#');
      expect(sanitizeNameLikeYtDlp('filename...')).toBe('filename..#');
    });

    it('should replace only the last trailing space', () => {
      expect(sanitizeNameLikeYtDlp('filename ')).toBe('filename#');
      expect(sanitizeNameLikeYtDlp('filename  ')).toBe('filename #');
    });

    it('should preserve internal dots and spaces', () => {
      expect(sanitizeNameLikeYtDlp('file.name')).toBe('file.name');
      expect(sanitizeNameLikeYtDlp('file name')).toBe('file name');
    });

    it('should handle real-world video titles', () => {
      expect(sanitizeNameLikeYtDlp('What is Python?')).toBe('What is Python#');
      // Colon is a forbidden char, so it gets replaced with #
      expect(sanitizeNameLikeYtDlp('C++ vs C#: The Battle')).toBe('C++ vs C## The Battle');
      // Only the last trailing dot is replaced
      expect(sanitizeNameLikeYtDlp('Video Title...')).toBe('Video Title..#');
      // Real case from user: Fred again . .
      expect(sanitizeNameLikeYtDlp('Fred again . .')).toBe('Fred again . #');
    });
  });
});
