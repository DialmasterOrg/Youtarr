const MAX_CUSTOM_ARGS_LENGTH = 2000;

class ParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * Pure-JS shell-style tokenizer. Handles single quotes, double quotes,
 * backslash-escaped spaces. NEVER passes input to a shell.
 * @param {string} input
 * @returns {string[]}
 * @throws {ParseError} on unterminated quotes
 */
function tokenize(input) {
  if (!input || !input.trim()) return [];

  const tokens = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escape = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

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

  if (inSingle) {
    throw new ParseError('Unterminated single quote in custom args');
  }
  if (inDouble) {
    throw new ParseError('Unterminated double quote in custom args');
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

// KEEP IN SYNC: client/src/components/Configuration/sections/ytdlpOptionsHelpers.ts
const BLOCKED_FLAGS = new Set([
  // Arbitrary command execution
  '--exec',
  '--exec-before-download',
  '--netrc-cmd',
  // Output path control (we own the path templates)
  '-o',
  '--output',
  '-P',
  '--paths',
  '--print-to-file',
  // External downloaders can read/write arbitrary paths and receive raw args
  '--external-downloader',
  '--downloader',
  '--external-downloader-args',
  '--downloader-args',
  // Config file loading (could re-introduce any of the above)
  '--config-location',
  '--config-locations',
  // Arbitrary file reads
  '--batch-file',
  '--load-info-json',
  // Cookie management (we own this via CookieConfigSection)
  '--cookies',
  '--cookies-from-browser',
  // Archive (we own ./config/complete.list)
  '--download-archive',
  // Tooling location (we set this ourselves)
  '--ffmpeg-location',
  // Already managed by dedicated config fields
  '--proxy',
  '-4',
  '--force-ipv4',
  '-6',
  '--force-ipv6',
  '--limit-rate',
  '--sleep-requests',
]);

// Short-form denylisted options that yt-dlp accepts with attached values
// (e.g. `-o/tmp/x`, `-P/tmp/dir`). Listed explicitly to avoid stripping
// unrelated tokens like `-4` (which does not take a value) or unknown short
// flags like `-bogus`.
const ATTACHED_VALUE_SHORT_FLAGS = new Set(['-o', '-P']);

/**
 * Reduce a token to its comparable flag name so the denylist check matches
 * yt-dlp's argparse semantics. Without this, `--exec=rm -rf` and `-o/tmp/x`
 * sneak past an exact-match check.
 *
 * - `--foo=bar` -> `--foo`
 * - `-oVALUE`   -> `-o` (only for known attached-value short options)
 * - everything else returned unchanged
 *
 * @param {string} token
 * @returns {string}
 */
function normalizeFlag(token) {
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
 * Validate a token list against the denylist AND reject stray positional tokens.
 *
 * Positional rejection: yt-dlp treats any non-flag token (no leading dash) as
 * a URL or search keyword, which is NOT what custom args are for. Without this
 * check, "dddd wwew" would be silently swallowed by yt-dlp's argparse as
 * positional URLs, and the dry-run would falsely report the args as valid.
 *
 * Heuristic: a non-flag token is allowed only if the immediately preceding
 * token IS a flag (i.e. the non-flag is the value of that flag, e.g. `--retries 5`).
 * The first token must always be a flag. This catches the common confusion
 * (typing random words or values where flags are expected) without needing
 * yt-dlp's full flag-takes-value table.
 *
 * @param {string[]} tokens
 * @returns {{ ok: boolean, error?: string }}
 */
function validate(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const normalized = normalizeFlag(token);

    if (BLOCKED_FLAGS.has(normalized)) {
      return {
        ok: false,
        error: `${normalized} is not allowed in custom args. Use the dedicated setting field instead.`,
      };
    }

    if (!token.startsWith('-')) {
      // Non-flag token: must be a value of the previous flag.
      const prev = i > 0 ? tokens[i - 1] : null;
      if (!prev || !prev.startsWith('-')) {
        return {
          ok: false,
          error: `"${token}" looks like a positional argument. Custom args must be yt-dlp flags (e.g. --concurrent-fragments 4). Quote values with spaces.`,
        };
      }
    }
  }
  return { ok: true };
}

module.exports = {
  tokenize,
  validate,
  normalizeFlag,
  ParseError,
  BLOCKED_FLAGS,
  ATTACHED_VALUE_SHORT_FLAGS,
  MAX_CUSTOM_ARGS_LENGTH,
};
