import {
  validatePrefix,
  lengthSeverity,
  hasUntruncatedTitle,
  hasLockedSuffixToken,
  hasOversizedTitleTruncation,
} from '../validate';

describe('validatePrefix', () => {
  it('accepts the default prefix', () => {
    const r = validatePrefix('%(uploader,channel,uploader_id).80B - %(title).76B');
    expect(r.ok).toBe(true);
  });

  it('rejects an empty prefix', () => {
    const r = validatePrefix('');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/empty/i);
  });

  it('rejects a whitespace-only prefix', () => {
    const r = validatePrefix('   ');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/empty/i);
  });

  it('rejects forward slash', () => {
    const r = validatePrefix('%(uploader)s/%(title)s');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/path separator/i);
  });

  it('rejects backslash', () => {
    const r = validatePrefix('%(uploader)s\\%(title)s');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/path separator/i);
  });

  it('rejects path traversal sequence ..', () => {
    const r = validatePrefix('..%(title)s');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/traversal/i);
  });

  it('rejects ASCII control chars', () => {
    const r = validatePrefix('hello\x07world');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/control/i);
  });

  it('rejects NUL byte', () => {
    const r = validatePrefix('hello\x00world');
    expect(r.ok).toBe(false);
  });

  it('rejects char truncation without a yt-dlp conversion char', () => {
    const r = validatePrefix('%(title).40');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/truncation/i);
  });

  it('rejects incomplete yt-dlp tokens', () => {
    const r = validatePrefix('%(title)');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/syntax/i);
  });

  it('rejects unescaped literal percent signs', () => {
    const r = validatePrefix('100% done - %(title).76B');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/syntax/i);
  });

  it('accepts escaped literal percent signs', () => {
    const r = validatePrefix('100%% done - %(title).76B');
    expect(r.ok).toBe(true);
  });

  it('accepts char truncation with an explicit string conversion', () => {
    const r = validatePrefix('%(title).40s');
    expect(r.ok).toBe(true);
  });

  it('rejects overlong prefixes', () => {
    const r = validatePrefix('a'.repeat(161));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/160/);
  });
});

describe('hasLockedSuffixToken', () => {
  it('flags an explicit video ID token', () => {
    expect(hasLockedSuffixToken('%(title).76B %(id)s')).toBe(true);
  });

  it('flags an explicit extension token', () => {
    expect(hasLockedSuffixToken('%(title).76B.%(ext)s')).toBe(true);
  });

  it('flags %(display_id)s because it resolves to the same 11-char video ID as %(id)s', () => {
    expect(hasLockedSuffixToken('%(display_id)s - %(title).76B')).toBe(true);
  });

  it('does not flag unrelated tokens', () => {
    expect(hasLockedSuffixToken('%(channel_id)s - %(title).76B')).toBe(false);
  });
});

describe('lengthSeverity', () => {
  it('returns ok for short filenames', () => {
    expect(lengthSeverity(50)).toBe('ok');
    expect(lengthSeverity(110)).toBe('ok');
  });

  it('returns warn above 110', () => {
    expect(lengthSeverity(111)).toBe('warn');
    expect(lengthSeverity(130)).toBe('warn');
  });

  it('returns danger above 130', () => {
    expect(lengthSeverity(131)).toBe('danger');
  });
});

describe('hasUntruncatedTitle', () => {
  it('flags a bare %(title)s', () => {
    expect(hasUntruncatedTitle('%(title)s')).toBe(true);
  });

  it('does not flag truncated title', () => {
    expect(hasUntruncatedTitle('%(title).76B')).toBe(false);
  });

  it('does not flag templates without title', () => {
    expect(hasUntruncatedTitle('%(uploader)s')).toBe(false);
  });
});

describe('hasOversizedTitleTruncation', () => {
  it('flags %(title).100B', () => {
    expect(hasOversizedTitleTruncation('%(uploader)s - %(title).100B')).toBe(true);
  });

  it('flags %(title).150B', () => {
    expect(hasOversizedTitleTruncation('%(title).150B')).toBe(true);
  });

  it('does not flag the recommended %(title).76B', () => {
    expect(hasOversizedTitleTruncation('%(title).76B')).toBe(false);
  });

  it('does not flag below the recommended limit', () => {
    expect(hasOversizedTitleTruncation('%(title).50B')).toBe(false);
  });

  it('does not flag bare %(title)s (handled by hasUntruncatedTitle)', () => {
    expect(hasOversizedTitleTruncation('%(title)s')).toBe(false);
  });

  it('does not flag character truncation', () => {
    expect(hasOversizedTitleTruncation('%(title).200s')).toBe(false);
  });

  it('handles fallback chains', () => {
    expect(hasOversizedTitleTruncation('%(title,description).200B')).toBe(true);
  });

  it('does not flag templates without title', () => {
    expect(hasOversizedTitleTruncation('%(uploader).200B')).toBe(false);
  });
});
