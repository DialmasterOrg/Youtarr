export const MAX_CUSTOM_ARGS_LENGTH = 2000;
const RATE_LIMIT_REGEX = /^\d+(\.\d+)?[KkMmGg]?$/;

// Whether a custom-args option is allowed is decided ONLY by the server
// (server/modules/download/ytdlpOptionTable.js); the client never carries that
// list. The helpers below are table-free structural checks that give fast
// as-you-type feedback for the common mistakes (stray words, bad rate format);
// the authoritative allow/deny result arrives as `customArgsCheck` from
// /getconfig and from the Validate / Save responses.

/**
 * Lightweight shell-style tokenizer for inline checks. Mirrors the server
 * tokenizer enough to avoid false positional errors for quoted values.
 */
export function tokenizeArgs(input: string): string[] {
  if (!input.trim()) return [];

  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escape = false;

  for (const ch of input) {
    if (escape) {
      current += ch;
      escape = false;
      continue;
    }

    if (ch === '\\' && !inSingle) {
      escape = true;
      continue;
    }

    if (ch === '\'' && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if (!inSingle && !inDouble && /\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += ch;
  }

  if (current.length > 0) tokens.push(current);
  return tokens;
}

/**
 * Validate the download rate-limit string against yt-dlp's --limit-rate format.
 * Empty input is valid (means "no limit"). Single source of truth shared by
 * the section's blur display and the central save-time validator.
 *
 * @returns null when valid, otherwise an error message.
 */
export function validateRateLimit(value: string | null | undefined): string | null {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  if (!RATE_LIMIT_REGEX.test(trimmed)) {
    return 'Invalid rate format. Use e.g. 5M, 500K, 1.5M';
  }
  return null;
}

/**
 * Detect a stray positional token (a non-flag NOT preceded by a flag), the
 * common "typed a value where a flag goes" mistake. This is structural and
 * needs no option table, so the client can flag it inline before Save.
 *
 * Returns the offending token if any, else null.
 */
export function getPositionalTokenInArgs(input: string): string | null {
  const tokens = tokenizeArgs(input);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith('-')) continue;
    const prev = i > 0 ? tokens[i - 1] : null;
    if (!prev || !prev.startsWith('-')) return token;
  }
  return null;
}
