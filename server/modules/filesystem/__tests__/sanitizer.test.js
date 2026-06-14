const {
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
