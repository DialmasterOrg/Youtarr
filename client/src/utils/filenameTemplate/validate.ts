export type Severity = 'ok' | 'warn' | 'danger';

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x00-\x1f]/;
export const MAX_VIDEO_FILENAME_PREFIX_LENGTH = 160;

/**
 * Client-side prefix validation.
 *
 * Only checks safety/UX rules that don't require parsing yt-dlp's template
 * grammar:
 *   - non-empty
 *   - length <= MAX_VIDEO_FILENAME_PREFIX_LENGTH
 *   - no path separators (defense-in-depth against path injection)
 *   - no ".." (path traversal)
 *   - no ASCII control chars
 *
 * Authoritative template-syntax validation (conversion chars, format flags,
 * width/precision, yt-dlp-specific modifiers like `+S` / `#j`) lives on the
 * backend and uses yt-dlp itself. Re-implementing yt-dlp's printf-derived
 * grammar in a regex produced false rejections for valid templates like
 * `%(view_count)05d` and `%(uploader)20s`.
 */
export function validatePrefix(prefix: string | null | undefined): ValidationResult {
  // Called with values loaded from /getconfig, which can omit fields at runtime
  // despite the ConfigState type. Guard so `.replace` doesn't crash on undefined.
  if (typeof prefix !== 'string') {
    return { ok: false, error: 'Prefix may not be empty.' };
  }
  const trimmedPrefix = prefix.replace(/\s+$/, '');
  if (trimmedPrefix.trim().length === 0) {
    return { ok: false, error: 'Prefix may not be empty.' };
  }
  if (trimmedPrefix.length > MAX_VIDEO_FILENAME_PREFIX_LENGTH) {
    return {
      ok: false,
      error: `Prefix may not exceed ${MAX_VIDEO_FILENAME_PREFIX_LENGTH} characters.`,
    };
  }
  if (trimmedPrefix.includes('/') || trimmedPrefix.includes('\\')) {
    return { ok: false, error: 'Prefix may not contain path separators (/ or \\).' };
  }
  if (trimmedPrefix.includes('..')) {
    return { ok: false, error: 'Prefix may not contain ".." (path traversal).' };
  }
  if (CONTROL_CHAR_RE.test(trimmedPrefix)) {
    return { ok: false, error: 'Prefix may not contain ASCII control characters.' };
  }
  return { ok: true };
}

/**
 * Length warnings use rendered JavaScript string length as path-length guidance.
 * This is intentionally separate from yt-dlp's `.NB` UTF-8 byte truncation.
 */
export function lengthSeverity(length: number): Severity {
  if (length > 130) return 'danger';
  if (length > 110) return 'warn';
  return 'ok';
}

export function hasUntruncatedTitle(prefix: string): boolean {
  // Matches %(title)s without a trailing .NB or .Ns truncation modifier.
  return /%\(title(?:[,|][^)]*)?\)s/.test(prefix) && !/%\(title[^)]*\.\d+B?\)s?/.test(prefix);
}

// 76 bytes is the validated-safe upper bound for the title token. yt-dlp's
// channel template uses .80B and the locked suffix is 17 bytes; staying at .76B
// keeps full paths within Windows' 260-char limit even for deep subfolders and
// multi-byte titles. Past incidents (#404) showed character-based truncation
// produced 200+ byte filenames in CJK locales - never widen this bound silently.
export const RECOMMENDED_TITLE_BYTE_LIMIT = 76;

export function hasOversizedTitleTruncation(prefix: string): boolean {
  const matches = prefix.matchAll(/%\(title(?:[,|][^)]*)?\)\.(\d+)B/g);
  for (const match of matches) {
    if (Number(match[1]) > RECOMMENDED_TITLE_BYTE_LIMIT) return true;
  }
  return false;
}

/**
 * Locked-suffix advisory: detect whether the prefix already references id,
 * display_id, or ext. Doesn't depend on the conversion char that follows the
 * `)`, so it catches `%(id)s`, `%(id)d`, `%(ext)x`, padded forms like
 * `%(id)10s`, etc.
 */
export function hasLockedSuffixToken(prefix: string): boolean {
  const matches = prefix.matchAll(/%\(([^)]+)\)/g);
  for (const match of matches) {
    const fieldSpec = match[1].split('>')[0].split('|')[0];
    const fields = fieldSpec.split(',').map((field) => field.trim());
    if (fields.includes('id') || fields.includes('display_id') || fields.includes('ext')) {
      return true;
    }
  }
  return false;
}
