const {
  compilePattern,
  buildShowFilter,
  excludeTermRegex,
  validateSources,
  isAssignableSeason,
  PatternError,
} = require('../patternCompiler');

const simple = (text) => compilePattern({ text, kind: 'simple' });
const regex = (text) => compilePattern({ text, kind: 'regex' });

describe('patternCompiler', () => {
  describe('simple syntax', () => {
    it('matches literal text case-insensitively anywhere in the title', () => {
      expect(simple('BEYBLADE EN').compiledRegex).toBe('(?i)BEYBLADE\\s+EN');
    });

    it('turns a run of spaces into any run of whitespace', () => {
      expect(simple('Secret   Life').compiledRegex).toBe('(?i)Secret\\s+Life');
    });

    it('compiles number placeholders to ASCII digits only', () => {
      expect(simple('Episode {episode}').compiledRegex).toBe('(?i)Episode\\s+(?P<episode>[0-9]+)');
    });

    it('compiles season, episode_end and part placeholders', () => {
      expect(simple('{season}x{episode_end}p{part}').compiledRegex)
        .toBe('(?i)(?P<season>[0-9]+)x(?P<episode_end>[0-9]+)p(?P<part>[0-9]+)');
    });

    it('makes {title} lazy when more pattern text follows', () => {
      expect(simple('{title} | Official Clip').compiledRegex)
        .toBe('(?i)(?P<title>.+?)\\s+\\|\\s+Official\\s+Clip');
    });

    it('makes a trailing {title} greedy and anchored to the end', () => {
      expect(simple('Episode {episode}: {title}').compiledRegex)
        .toBe('(?i)Episode\\s+(?P<episode>[0-9]+):\\s+(?P<title>.+)$');
    });

    it('treats {title} followed only by spaces as trailing', () => {
      expect(simple('Ep {episode} {title}  ').compiledRegex).toBe('(?i)Ep\\s+(?P<episode>[0-9]+)\\s+(?P<title>.+)$');
    });

    it('compiles * to any text', () => {
      expect(simple('Ep.{episode} * | Ep.{episode_end} *').compiledRegex)
        .toBe('(?i)Ep\\.(?P<episode>[0-9]+)\\s+.*?\\s+\\|\\s+Ep\\.(?P<episode_end>[0-9]+)\\s+.*?');
    });

    it('anchors to the start of the title when the pattern starts with ^', () => {
      expect(simple('^Hermitcraft {season}').compiledRegex).toBe('(?i)^Hermitcraft\\s+(?P<season>[0-9]+)');
    });

    it('escapes regex metacharacters in literal text', () => {
      expect(simple('a.b(c)[d]+e?f$g|h\\i').compiledRegex).toBe('(?i)a\\.b\\(c\\)\\[d\\]\\+e\\?f\\$g\\|h\\\\i');
    });

    it('keeps non-ASCII text and quotes as they are', () => {
      expect(simple('EPISÓDIO \'x\' & y').compiledRegex).toBe('(?i)EPISÓDIO\\s+\'x\'\\s+&\\s+y');
    });

    it('keeps a brace that is not a placeholder as literal text', () => {
      expect(simple('Part { one').compiledRegex).toBe('(?i)Part\\s+\\{\\s+one');
    });

    it('refuses an unknown placeholder', () => {
      expect(() => simple('Episode {ep}')).toThrow(PatternError);
    });

    it('refuses a placeholder used twice', () => {
      expect(() => simple('{episode} and {episode}')).toThrow('{episode} appears more than once');
    });

    it('refuses a regex that is only flags', () => {
      expect(() => compilePattern({ text: '(?i)', kind: 'regex' })).toThrow('The pattern is empty.');
    });

    it('refuses an empty pattern', () => {
      expect(() => simple('   ')).toThrow(PatternError);
    });

    it('reports the placeholders it uses', () => {
      expect(simple('Hermitcraft {season}: Episode {episode} - {title}').groups)
        .toEqual(['season', 'episode', 'title']);
    });

    it('builds the filter form with unnamed groups and scoped flags', () => {
      expect(simple('Episode {episode}: {title}').filterRegex)
        .toBe('(?i:Episode\\s+(?:[0-9]+):\\s+(?:.+)$)');
    });
  });

  describe('regex mode', () => {
    it('keeps the regex as written', () => {
      expect(regex('^S(?P<season>\\d+)E(?P<episode>\\d+)').compiledRegex).toBe('^S(?P<season>\\d+)E(?P<episode>\\d+)');
    });

    it('reports the named groups it uses', () => {
      expect(regex('(?P<title>.+?) - (?P<episode>[0-9]+)').groups).toEqual(['title', 'episode']);
    });

    it('unnames groups in the filter form', () => {
      expect(regex('Ep(?P<episode>[0-9]+)').filterRegex).toBe('(?:Ep(?:[0-9]+))');
    });

    it('turns leading global flags into a scoped group in the filter form', () => {
      expect(regex('(?i)ep(?P<episode>[0-9]+)').filterRegex).toBe('(?i:ep(?:[0-9]+))');
    });

    it('merges several leading flag groups', () => {
      expect(regex('(?i)(?s)a.b').filterRegex).toBe('(?is:a.b)');
    });

    it('leaves escaped parentheses and character classes alone', () => {
      expect(regex('\\(?P<x>[(?P<y>]').filterRegex).toBe('(?:\\(?P<x>[(?P<y>])');
    });

    it('refuses named backreferences', () => {
      expect(() => regex('(?P<episode>[0-9]+) (?P=episode)')).toThrow('backreference');
    });

    // Unnaming groups, and joining a show's patterns into one alternation,
    // renumbers groups: a \1 would point at another group in the filter.
    it('refuses numbered backreferences', () => {
      expect(() => regex('^(?P<episode>[0-9]+)-(x)-\\1$')).toThrow('backreference');
    });

    it('refuses numbered backreferences in a pattern without named groups', () => {
      expect(() => regex('(a)\\12')).toThrow('backreference');
    });

    // Python reads a backslash and three octal digits as a character.
    it('allows a three-digit octal escape', () => {
      expect(regex('^\\123(?P<episode>[0-9]+)$').filterRegex).toBe('(?:^\\123(?:[0-9]+)$)');
    });

    it('allows a three-digit octal escape followed by another digit', () => {
      expect(regex('\\1234(?P<episode>[0-9]+)').compiledRegex).toBe('\\1234(?P<episode>[0-9]+)');
    });

    it.each(['(a)\\12', '(a)\\18', '(a)\\8', '(a)\\1x'])('refuses %s as a backreference', (pattern) => {
      expect(() => regex(pattern)).toThrow('backreference');
    });

    it('refuses conditional groups', () => {
      expect(() => regex('(a)?(?(1)b|c)(?P<episode>[0-9]+)')).toThrow('Conditional');
    });

    it('allows escaped backslashes before digits, octal escapes and digits in a character class', () => {
      expect(regex('a\\\\1\\0[\\1](?P<episode>[0-9]+)').filterRegex).toBe('(?:a\\\\1\\0[\\1](?:[0-9]+))');
    });

    it('refuses group names other than the placeholders', () => {
      expect(() => regex('(?P<number>[0-9]+)')).toThrow('number');
    });

    it('refuses global flags after the start', () => {
      expect(() => regex('abc(?i)')).toThrow('start');
    });
  });

  describe('buildShowFilter', () => {
    it('returns the one filter of a single pattern', () => {
      expect(buildShowFilter(['(?i:a)'])).toBe('(?i:a)');
    });

    it('joins several patterns into one alternation', () => {
      expect(buildShowFilter(['(?i:a)', '(?:b)'])).toBe('(?i:a)|(?:b)');
    });
  });

  describe('excludeTermRegex', () => {
    it('matches the term as literal text, ignoring case and spacing', () => {
      expect(excludeTermRegex(' Official  Clip. ')).toBe('(?i:Official\\s+Clip\\.)');
    });

    it('refuses an empty term', () => {
      expect(() => excludeTermRegex('  ')).toThrow(PatternError);
    });
  });

  describe('validateSources', () => {
    it('accepts title season and episode with both captured', () => {
      expect(validateSources({ groups: ['season', 'episode'], seasonSource: 'title', episodeSource: 'title' })).toBeNull();
    });

    it('needs {season} for a title season', () => {
      expect(validateSources({ groups: ['episode'], seasonSource: 'title', episodeSource: 'title' })).toMatch('{season}');
    });

    it('needs {episode} for a title episode', () => {
      expect(validateSources({ groups: [], seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'title' })).toMatch('{episode}');
    });

    it('needs a fixed season between 0 and 199', () => {
      expect(validateSources({ groups: [], seasonSource: 'fixed', seasonFixed: 200, episodeSource: 'order' })).toMatch('0 and 199');
    });

    it('accepts season 0', () => {
      expect(validateSources({ groups: [], seasonSource: 'fixed', seasonFixed: 0, episodeSource: 'order' })).toBeNull();
    });

    it('allows date episodes only in year seasons', () => {
      expect(validateSources({ groups: [], seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'date' })).toMatch('year');
    });

    it('accepts date episodes in year seasons', () => {
      expect(validateSources({ groups: [], seasonSource: 'year', episodeSource: 'date' })).toBeNull();
    });

    it('refuses an unknown source', () => {
      expect(validateSources({ groups: [], seasonSource: 'month', episodeSource: 'order' })).toMatch('season source');
    });
  });

  describe('isAssignableSeason', () => {
    it('accepts title seasons 0 to 199', () => {
      expect([isAssignableSeason(0), isAssignableSeason(199)]).toEqual([true, true]);
    });

    it('accepts upload years 1928 to 2500', () => {
      expect([isAssignableSeason(1928), isAssignableSeason(2024), isAssignableSeason(2500)]).toEqual([true, true, true]);
    });

    it('refuses numbers between the ranges, outside them, and non-integers', () => {
      expect([200, 1927, 2501, -1, 1.5, '1', null].map(isAssignableSeason)).toEqual([false, false, false, false, false, false, false]);
    });
  });
});
