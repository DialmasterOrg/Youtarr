export const MAX_CUSTOM_ARGS_LENGTH = 2000;
const RATE_LIMIT_REGEX = /^\d+(\.\d+)?[KkMmGg]?$/;

// KEEP IN SYNC: server/modules/download/customArgsParser.js
export const BLOCKED_FLAGS = new Set<string>([
  '--exec', '--exec-before-download', '--netrc-cmd',
  '-o', '--output',
  '-P', '--paths',
  '--print-to-file',
  '--external-downloader', '--downloader',
  '--external-downloader-args', '--downloader-args',
  '--config-location', '--config-locations',
  '--batch-file',
  '--load-info-json',
  '--cookies', '--cookies-from-browser',
  '--download-archive',
  '--ffmpeg-location',
  '--proxy',
  '-4', '--force-ipv4', '-6', '--force-ipv6',
  '--limit-rate',
  '--sleep-requests',
]);

const ATTACHED_VALUE_SHORT_FLAGS = new Set<string>(['-o', '-P']);

/**
 * Mirror of server-side normalizeFlag in customArgsParser.js. Reduces a token
 * to its comparable flag name so `--exec=rm` and `-o/tmp/x` are caught.
 */
export function normalizeFlag(token: string): string {
  if (!token || !token.startsWith('-')) return token;

  if (token.startsWith('--')) {
    const eqIdx = token.indexOf('=');
    return eqIdx >= 0 ? token.slice(0, eqIdx) : token;
  }

  if (token.length > 2) {
    const shortHead = token.slice(0, 2);
    if (ATTACHED_VALUE_SHORT_FLAGS.has(shortHead)) {
      return shortHead;
    }
  }

  return token;
}

/**
 * Lightweight shell-style tokenizer for inline validation. Mirrors the server
 * tokenizer enough to avoid false positional errors for quoted values.
 */
export function tokenizeForDenylistCheck(input: string): string[] {
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

export function getBlockedFlagInArgs(input: string): string | null {
  for (const token of tokenizeForDenylistCheck(input)) {
    const normalized = normalizeFlag(token);
    if (BLOCKED_FLAGS.has(normalized)) return normalized;
  }
  return null;
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
 * Detect a stray positional token (non-flag NOT preceded by a flag).
 * Mirrors the server-side customArgsParser.validate heuristic so the user
 * sees the inline error before clicking Save or Validate.
 *
 * Returns the offending token if any, else null.
 */
export function getPositionalTokenInArgs(input: string): string | null {
  const tokens = tokenizeForDenylistCheck(input);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith('-')) continue;
    const prev = i > 0 ? tokens[i - 1] : null;
    if (!prev || !prev.startsWith('-')) return token;
  }
  return null;
}
