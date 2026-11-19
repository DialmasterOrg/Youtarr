const {
  sanitizeNameLikeYtDlp,
  sanitizePathParts,
  sanitizeFilenameLikeYtDlp
} = require('../sanitizer');
const ytdlpFixture = require('./fixtures/ytdlpTitleSanitizer.json');

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

  describe('sanitizeFilenameLikeYtDlp', () => {
    const MAX_BYTES = 64;
    const byteLength = (text) => Buffer.byteLength(text, 'utf8');

    describe('matches yt-dlp output for the fixture corpus', () => {
      it.each(ytdlpFixture.cases.map((fixtureCase) => [JSON.stringify(fixtureCase.input), fixtureCase]))(
        '%s',
        (_label, { input, expected }) => {
          expect(sanitizeFilenameLikeYtDlp(input)).toBe(expected);
        }
      );
    });

    it('returns an empty string for empty or non-string input', () => {
      expect([sanitizeFilenameLikeYtDlp(''), sanitizeFilenameLikeYtDlp(null), sanitizeFilenameLikeYtDlp(undefined)])
        .toEqual(['', '', '']);
    });

    it('returns an underscore when every character is dropped', () => {
      expect(sanitizeFilenameLikeYtDlp('\u0001\u0002')).toBe('_');
    });

    it('leaves text within maxBytes unchanged', () => {
      expect(sanitizeFilenameLikeYtDlp('Short title', { maxBytes: MAX_BYTES })).toBe('Short title');
    });

    it('never exceeds maxBytes, unlike yt-dlp .64B which cuts before substituting', () => {
      const result = sanitizeFilenameLikeYtDlp(`${'a'.repeat(62)}??::`, { maxBytes: MAX_BYTES });
      expect(result).toBe(`${'a'.repeat(62)}`);
    });

    it.each(
      ytdlpFixture.cases
        .filter((fixtureCase) => byteLength(fixtureCase.expected) > MAX_BYTES)
        .map((fixtureCase) => [JSON.stringify(fixtureCase.input), fixtureCase])
    )('cuts %s to a whole-character prefix of the full result', (_label, { input, expected }) => {
      const result = sanitizeFilenameLikeYtDlp(input, { maxBytes: MAX_BYTES });
      expect({
        withinLimit: byteLength(result) <= MAX_BYTES,
        isPrefix: expected.startsWith(result),
        wholeCharacters: Buffer.from(result, 'utf8').toString('utf8') === result && !/[\ud800-\udfff]$/.test(result),
      }).toEqual({ withinLimit: true, isPrefix: true, wholeCharacters: true });
    });

    it('drops a multi-byte character that would cross the limit', () => {
      expect(sanitizeFilenameLikeYtDlp(`${'a'.repeat(63)}😀tail`, { maxBytes: MAX_BYTES })).toBe('a'.repeat(63));
    });

    it('drops a whole emoji sequence rather than leaving a joiner at the end', () => {
      expect(sanitizeFilenameLikeYtDlp(`${'a'.repeat(55)}👨‍👩‍👧`, { maxBytes: MAX_BYTES })).toBe('a'.repeat(55));
    });

    it('drops a whole flag rather than leaving half of it', () => {
      expect(sanitizeFilenameLikeYtDlp(`${'a'.repeat(60)}🇺🇸`, { maxBytes: MAX_BYTES })).toBe('a'.repeat(60));
    });

    it('drops whitespace left at the end by the cut', () => {
      expect(sanitizeFilenameLikeYtDlp(`${'a'.repeat(61)}   bcdef`, { maxBytes: MAX_BYTES })).toBe('a'.repeat(61));
    });

    it('ignores a maxBytes that is not a positive integer', () => {
      const long = 'a'.repeat(100);
      expect(sanitizeFilenameLikeYtDlp(long, { maxBytes: 0 })).toBe(long);
    });
  });
});
