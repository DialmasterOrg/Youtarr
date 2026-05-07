import { sanitizeWindowsFilename } from '../sanitize';

describe('sanitizeWindowsFilename', () => {
  it('returns input unchanged when no reserved chars are present', () => {
    expect(sanitizeWindowsFilename('Plain Title.mp4')).toBe('Plain Title.mp4');
  });

  it('replaces the seven yt-dlp --windows-filenames target characters', () => {
    expect(sanitizeWindowsFilename('Q&A: Best Tools? <Live> "Stream"|2024*'))
      .toBe('Q&A： Best Tools？ ＜Live＞ ＂Stream＂｜2024＊');
  });

  it('replaces colons in timestamp-like titles', () => {
    expect(sanitizeWindowsFilename('Live at 09:30:00')).toBe('Live at 09：30：00');
  });

  it('handles empty string', () => {
    expect(sanitizeWindowsFilename('')).toBe('');
  });

  it('does not modify path separators (those are blocked upstream by validation)', () => {
    expect(sanitizeWindowsFilename('a/b\\c')).toBe('a/b\\c');
  });
});
