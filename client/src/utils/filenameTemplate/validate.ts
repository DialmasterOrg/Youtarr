export type Severity = 'ok' | 'warn' | 'danger';

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x00-\x1f]/;
const TRUNCATION_WITHOUT_CONVERSION_RE = /%\([^)]*\)\.\d+(?![\dBsdjlqUDS])/;
// Keep in sync with server/routes/config.js and renderer.ts TOKEN_RE.
const TEMPLATE_TOKEN_AT_START_RE = /^%\([^)]+\)(?:(?:\.\d+B)|(?:(?:\.\d+)?[sdjlqUDS]))/;
const TEMPLATE_TOKEN_RE = /%\(([^)]+)\)(?:(?:\.\d+B)|(?:(?:\.\d+)?[sdjlqUDS]))/g;
export const MAX_VIDEO_FILENAME_PREFIX_LENGTH = 160;

function validatePercentSyntax(prefix: string): ValidationResult {
  for (let i = 0; i < prefix.length; i += 1) {
    if (prefix[i] !== '%') continue;
    if (prefix[i + 1] === '%') {
      i += 1;
      continue;
    }

    const match = prefix.slice(i).match(TEMPLATE_TOKEN_AT_START_RE);
    if (match) {
      i += match[0].length - 1;
      continue;
    }

    return {
      ok: false,
      error: 'Invalid yt-dlp template syntax. Use tokens like %(title)s or escape literal percent signs as %%.',
    };
  }

  return { ok: true };
}

export function validatePrefix(prefix: string): ValidationResult {
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
  if (TRUNCATION_WITHOUT_CONVERSION_RE.test(trimmedPrefix)) {
    return { ok: false, error: 'Truncation must use yt-dlp syntax like %(title).76B or %(title).40s.' };
  }
  return validatePercentSyntax(trimmedPrefix);
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

export function hasLockedSuffixToken(prefix: string): boolean {
  let match: RegExpExecArray | null;
  TEMPLATE_TOKEN_RE.lastIndex = 0;
  while ((match = TEMPLATE_TOKEN_RE.exec(prefix)) !== null) {
    const fieldSpec = match[1].split('>')[0].split('|')[0];
    const fields = fieldSpec.split(',').map((field) => field.trim());
    if (fields.includes('id') || fields.includes('display_id') || fields.includes('ext')) {
      return true;
    }
  }
  return false;
}
