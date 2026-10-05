/**
 * Title patterns of title shows, compiled to Python regexes (classification
 * and yt-dlp's match filter both run Python's re, so a pattern behaves the
 * same in the preview, at save, at finalize and in channel downloads).
 *
 * Simple syntax: literal text matches ignoring case, a space matches any run
 * of whitespace, `*` matches any text, a leading `^` anchors to the start of
 * the title, and placeholders capture parts of it: {season}, {episode},
 * {episode_end} and {part} (ASCII digits: Python's \d also matches digits JS
 * can't parse) and {title} (the episode title; lazy when more pattern text
 * follows, else greedy to the end of the title).
 *
 * Regex mode takes a Python regex with the same names as named groups.
 *
 * Each pattern also gets a filter form for yt-dlp's match filter: groups
 * unnamed (a show's patterns are joined into one alternation, and repeated
 * group names are an error there) and leading flags scoped to a group (a
 * global flag that isn't at the start is an error too).
 */

const PATTERN_KIND = Object.freeze({ SIMPLE: 'simple', REGEX: 'regex' });
const SEASON_SOURCE = Object.freeze({ TITLE: 'title', FIXED: 'fixed', YEAR: 'year' });
const EPISODE_SOURCE = Object.freeze({ TITLE: 'title', DATE: 'date', ORDER: 'order' });
const GROUP_NAMES = Object.freeze(['season', 'episode', 'episode_end', 'part', 'title']);
const NUMBER_GROUPS = new Set(['season', 'episode', 'episode_end', 'part']);
const MAX_SEASON = 199;
// Upload-year seasons; Jellyfin reads 200-1927 and anything above 2500 as no season.
const MIN_YEAR_SEASON = 1928;
const MAX_YEAR_SEASON = 2500;
const MAX_PATTERN_LENGTH = 500;

// Characters with a meaning in a Python regex outside a character class.
const REGEX_SPECIAL = new Set(['\\', '.', '^', '$', '*', '+', '?', '{', '}', '[', ']', '|', '(', ')']);
const PLACEHOLDER = /^\{([A-Za-z_]+)\}/;
const FLAG_GROUP = /^\(\?([aiLmsux]+)\)/;

class PatternError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PatternError';
    this.status = 400;
  }
}

function escapeLiteral(text) {
  let out = '';
  for (const char of text) out += REGEX_SPECIAL.has(char) ? `\\${char}` : char;
  return out;
}

// Literal text with whitespace runs as \s+.
function literalRegex(text) {
  return text.trim().split(/\s+/).map(escapeLiteral).join('\\s+');
}

function tokenizeSimple(text) {
  const tokens = [];
  let literal = '';
  const flush = () => {
    if (literal) tokens.push({ type: 'literal', value: literal });
    literal = '';
  };
  for (let i = 0; i < text.length;) {
    const rest = text.slice(i);
    const placeholder = PLACEHOLDER.exec(rest);
    if (placeholder) {
      flush();
      tokens.push({ type: 'placeholder', name: placeholder[1] });
      i += placeholder[0].length;
    } else if (rest[0] === '*') {
      flush();
      tokens.push({ type: 'any' });
      i += 1;
    } else if (/\s/.test(rest[0])) {
      flush();
      if (tokens.length === 0 || tokens[tokens.length - 1].type !== 'space') tokens.push({ type: 'space' });
      i += 1;
    } else {
      literal += rest[0];
      i += 1;
    }
  }
  flush();
  return tokens;
}

function compileSimple(text) {
  let body = text.trim();
  const anchored = body.startsWith('^');
  if (anchored) body = body.slice(1).trimStart();
  if (!body) throw new PatternError('The pattern is empty.');

  const tokens = tokenizeSimple(body);
  while (tokens.length && tokens[tokens.length - 1].type === 'space') tokens.pop();
  const groups = [];
  const parts = tokens.map((token, index) => {
    if (token.type === 'literal') return escapeLiteral(token.value);
    if (token.type === 'space') return '\\s+';
    if (token.type === 'any') return '.*?';
    const { name } = token;
    if (!GROUP_NAMES.includes(name)) {
      throw new PatternError(`Unknown placeholder {${name}}. Use {season}, {episode}, {episode_end}, {part} or {title}.`);
    }
    if (groups.includes(name)) throw new PatternError(`{${name}} appears more than once.`);
    groups.push(name);
    if (NUMBER_GROUPS.has(name)) return `(?P<${name}>[0-9]+)`;
    return index === tokens.length - 1 ? '(?P<title>.+)$' : '(?P<title>.+?)';
  });
  const source = `${anchored ? '^' : ''}${parts.join('')}`;
  return {
    compiledRegex: `(?i)${source}`,
    filterRegex: `(?i:${unnameGroups(source)})`,
    groups,
  };
}

// Walk a regex outside escapes and character classes, calling visit(i) at
// each '(' that opens a group; visit returns how many characters it consumed
// (0 to copy the '(' as is).
function scanGroups(source, visit) {
  let out = '';
  let inClass = false;
  for (let i = 0; i < source.length;) {
    const char = source[i];
    if (char === '\\') {
      out += source.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (inClass) {
      if (char === ']') inClass = false;
      out += char;
      i += 1;
      continue;
    }
    if (char === '[') {
      inClass = true;
      out += char;
      // A ']' right after '[' or '[^' is a literal member.
      const next = source.slice(i + 1, i + 3);
      const literalClose = next.startsWith(']') ? 1 : next === '^]' ? 2 : 0;
      out += source.slice(i + 1, i + 1 + literalClose);
      i += 1 + literalClose;
      continue;
    }
    if (char === '(') {
      const result = visit(i);
      if (result) {
        out += result.text;
        i += result.consumed;
        continue;
      }
    }
    out += char;
    i += 1;
  }
  return out;
}

function unnameGroups(source) {
  return scanGroups(source, (i) => {
    const named = /^\(\?P<([A-Za-z_][A-Za-z0-9_]*)>/.exec(source.slice(i));
    return named ? { text: '(?:', consumed: named[0].length } : null;
  });
}

function compileRegex(text) {
  const source = text.trim();
  if (!source) throw new PatternError('The pattern is empty.');

  let flags = '';
  let rest = source;
  for (let match = FLAG_GROUP.exec(rest); match; match = FLAG_GROUP.exec(rest)) {
    for (const flag of match[1]) if (!flags.includes(flag)) flags += flag;
    rest = rest.slice(match[0].length);
  }
  if (!rest.trim()) throw new PatternError('The pattern is empty.');

  const groups = [];
  scanGroups(rest, (i) => {
    const tail = rest.slice(i);
    if (tail.startsWith('(?P=')) {
      throw new PatternError('Named backreferences such as (?P=episode) are not supported: the download filter drops group names.');
    }
    if (FLAG_GROUP.test(tail)) throw new PatternError('Global flags such as (?i) must be at the start of the pattern.');
    const named = /^\(\?P<([A-Za-z_][A-Za-z0-9_]*)>/.exec(tail);
    if (named) {
      const name = named[1];
      if (!GROUP_NAMES.includes(name)) {
        throw new PatternError(`Unknown group name "${name}". Use season, episode, episode_end, part or title.`);
      }
      if (groups.includes(name)) throw new PatternError(`The group "${name}" appears more than once.`);
      groups.push(name);
    }
    return null;
  });

  return {
    compiledRegex: source,
    filterRegex: `(?${flags}:${unnameGroups(rest)})`,
    groups,
  };
}

/**
 * @param {{text: string, kind: 'simple'|'regex'}} pattern
 * @returns {{compiledRegex: string, filterRegex: string, groups: string[]}}
 * @throws {PatternError}
 */
function compilePattern({ text, kind }) {
  if (typeof text !== 'string') throw new PatternError('The pattern must be text.');
  if (text.length > MAX_PATTERN_LENGTH) throw new PatternError(`Patterns are limited to ${MAX_PATTERN_LENGTH} characters.`);
  if (kind === PATTERN_KIND.SIMPLE) return compileSimple(text);
  if (kind === PATTERN_KIND.REGEX) return compileRegex(text);
  throw new PatternError('The pattern kind must be "simple" or "regex".');
}

/**
 * One show's download filter: its patterns' filter forms as one alternation.
 * @param {string[]} filterRegexes
 */
function buildShowFilter(filterRegexes) {
  return filterRegexes.join('|');
}

/**
 * An exclude term as a case-insensitive literal regex.
 * @param {string} term
 */
function excludeTermRegex(term) {
  const text = typeof term === 'string' ? term.trim() : '';
  if (!text) throw new PatternError('Exclude terms can\'t be empty.');
  return `(?i:${literalRegex(text)})`;
}

/**
 * A season number a video can be assigned to or a season name given for: a
 * title or fixed season (0..199) or an upload year (1928..2500). Captured
 * seasons stay limited to 0..199 (validateSources, titleMatcher).
 * @param {*} season
 * @returns {boolean}
 */
function isAssignableSeason(season) {
  return Number.isInteger(season)
    && ((season >= 0 && season <= MAX_SEASON) || (season >= MIN_YEAR_SEASON && season <= MAX_YEAR_SEASON));
}

/**
 * Why a pattern's season and episode sources don't fit its placeholders, or null.
 * @param {Object} params
 * @param {string[]} params.groups - The pattern's placeholders
 * @param {string} params.seasonSource
 * @param {number|null} [params.seasonFixed]
 * @param {string} params.episodeSource
 * @returns {string|null}
 */
function validateSources({ groups, seasonSource, seasonFixed = null, episodeSource }) {
  if (!Object.values(SEASON_SOURCE).includes(seasonSource)) return 'Choose a season source: title, fixed or year.';
  if (!Object.values(EPISODE_SOURCE).includes(episodeSource)) return 'Choose an episode source: title, date or order.';
  if (seasonSource === SEASON_SOURCE.TITLE && !groups.includes('season')) {
    return 'A season taken from the title needs {season} in the pattern.';
  }
  if (seasonSource === SEASON_SOURCE.FIXED
    && !(Number.isInteger(seasonFixed) && seasonFixed >= 0 && seasonFixed <= MAX_SEASON)) {
    return `A fixed season must be a whole number between 0 and ${MAX_SEASON}.`;
  }
  if (episodeSource === EPISODE_SOURCE.TITLE && !groups.includes('episode')) {
    return 'An episode taken from the title needs {episode} in the pattern.';
  }
  if (episodeSource === EPISODE_SOURCE.DATE && seasonSource !== SEASON_SOURCE.YEAR) {
    return 'Upload-time episode numbers need year seasons: numbers from different years would collide.';
  }
  return null;
}

module.exports = {
  PATTERN_KIND,
  SEASON_SOURCE,
  EPISODE_SOURCE,
  GROUP_NAMES,
  MAX_SEASON,
  MIN_YEAR_SEASON,
  MAX_YEAR_SEASON,
  PatternError,
  compilePattern,
  buildShowFilter,
  excludeTermRegex,
  isAssignableSeason,
  validateSources
};
