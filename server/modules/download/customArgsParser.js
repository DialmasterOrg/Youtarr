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

const {
  BUCKET,
  UNKNOWN_REASON,
  getBucket,
  resolveLongName,
  resolveShortName,
} = require('./ytdlpOptionTable');

// Emit the canonical option name plus its values into `args`, record a warning,
// or record a blocked entry; in every case consume the option's values so a
// trailing value never leaks out as a stray positional. `given` is what the
// user typed (option name only, never a value).
function applyPolicy(spec, given, values, out) {
  const { bucket, reason } = getBucket(spec.canonical);
  if (bucket === BUCKET.BLOCK) {
    out.blocked.push({ given, option: spec.canonical, reason });
    return;
  }
  if (bucket === BUCKET.WARN) {
    out.warnings.push({ given, option: spec.canonical, reason });
  }
  out.args.push(spec.canonical, ...values);
}

// Pull `arity` values for an option. `inline` (from `--opt=value` or `-oVALUE`)
// supplies the first value; the rest come from the following tokens, consumed
// unconditionally the way optparse does (even if they start with '-'). Returns
// the values and the new index, or an error if there are too few tokens.
function takeValues(tokens, nextIndex, arity, inline, given) {
  const values = [];
  let i = nextIndex;
  if (inline !== null) values.push(inline);
  while (values.length < arity) {
    if (i >= tokens.length) {
      return { error: `${given} needs a value but none was given.` };
    }
    values.push(tokens[i]);
    i += 1;
  }
  return { values, index: i };
}

function handleLong(token, tokens, i, out) {
  const eq = token.indexOf('=');
  const name = eq >= 0 ? token.slice(0, eq) : token;
  const inline = eq >= 0 ? token.slice(eq + 1) : null;

  const resolved = resolveLongName(name);
  if (resolved.unknown) {
    out.blocked.push({ given: name, option: name, reason: UNKNOWN_REASON });
    return i + 1;
  }
  if (resolved.ambiguous) {
    out.errors.push(`"${name}" is ambiguous (matches ${resolved.ambiguous.join(', ')}).`);
    return i + 1;
  }

  const spec = resolved.spec;
  if (spec.arity === 0) {
    if (inline !== null) {
      out.errors.push(`${name} does not take a value.`);
      return i + 1;
    }
    applyPolicy(spec, name, [], out);
    return i + 1;
  }

  const taken = takeValues(tokens, i + 1, spec.arity, inline, name);
  if (taken.error) {
    out.errors.push(taken.error);
    return tokens.length;
  }
  applyPolicy(spec, name, taken.values, out);
  return taken.index;
}

function handleShort(token, tokens, i, out) {
  // Walk the characters of a short-option token (e.g. "-iw" or "-N4"), the way
  // optparse does: each letter is an option; the first value-taking letter
  // takes the remainder of the token (or the next tokens) as its value.
  let j = 1;
  while (j < token.length) {
    const shortName = `-${token[j]}`;
    const spec = resolveShortName(shortName);
    if (!spec) {
      out.blocked.push({ given: shortName, option: shortName, reason: UNKNOWN_REASON });
      return i + 1;
    }
    if (spec.arity === 0) {
      applyPolicy(spec, shortName, [], out);
      j += 1;
      continue;
    }
    const attached = j + 1 < token.length ? token.slice(j + 1) : null;
    const taken = takeValues(tokens, i + 1, spec.arity, attached, shortName);
    if (taken.error) {
      out.errors.push(taken.error);
      return tokens.length;
    }
    applyPolicy(spec, shortName, taken.values, out);
    return taken.index;
  }
  return i + 1;
}

/**
 * Resolve each user-supplied token to its canonical yt-dlp option and check it
 * against the ALLOW / WARN / BLOCK policy in ytdlpOptionTable.js. Because the
 * returned `args` carry canonical option names, yt-dlp reads them the same way
 * this check did, even after a runtime yt-dlp update.
 *
 * @param {string} rawString - Raw custom-args string from config.
 * @returns {{
 *   ok: boolean,
 *   args: string[],                              // allow + warn options, canonical, values as separate tokens
 *   blocked: {given: string, option: string, reason: string}[],
 *   warnings: {given: string, option: string, reason: string}[],
 *   errors: string[],
 * }} `ok` is true only when nothing was blocked and there were no errors.
 *    Values are never placed in blocked/warnings/errors (they may be secrets).
 */
function checkCustomArgs(rawString) {
  const out = { ok: true, args: [], blocked: [], warnings: [], errors: [] };

  let tokens;
  try {
    tokens = tokenize(rawString);
  } catch (err) {
    out.errors.push(err.message);
    out.ok = false;
    return out;
  }

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token === '--' || token === '-') {
      out.errors.push(`"${token}" is not a yt-dlp option.`);
      i += 1;
    } else if (token.startsWith('--')) {
      i = handleLong(token, tokens, i, out);
    } else if (token.startsWith('-') && token.length > 1) {
      i = handleShort(token, tokens, i, out);
    } else {
      out.errors.push(
        `"${token}" looks like a positional argument. Custom args must be yt-dlp flags (for example --concurrent-fragments 4). Quote values that contain spaces.`
      );
      i += 1;
    }
  }

  out.ok = out.blocked.length === 0 && out.errors.length === 0;
  return out;
}

/**
 * Project a checkCustomArgs result down to the fields safe to return to the
 * client / persist alongside a response: the blocked, warnings and errors
 * lists, without the resolved `args` (which carry option values).
 *
 * @param {ReturnType<typeof checkCustomArgs>} check
 * @returns {{ blocked: object[], warnings: object[], errors: string[] }}
 */
function summarize(check) {
  return {
    blocked: check.blocked,
    warnings: check.warnings,
    errors: check.errors,
  };
}

/**
 * One human-readable sentence for a failed check, naming every parse error and
 * every blocked option (option names only, as recorded by checkCustomArgs).
 *
 * @param {ReturnType<typeof checkCustomArgs>} check
 * @returns {string}
 */
function describeCheckFailure(check) {
  const blocked = check.blocked.map((b) => `${b.given} (${b.reason})`).join('; ');
  const parts = [...check.errors];
  if (blocked) parts.push(`Not allowed: ${blocked}.`);
  return `Custom yt-dlp options are not valid: ${parts.join(' ')}`;
}

module.exports = {
  tokenize,
  checkCustomArgs,
  summarize,
  describeCheckFailure,
  ParseError,
  MAX_CUSTOM_ARGS_LENGTH,
};
