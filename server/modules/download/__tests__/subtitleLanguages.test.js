/* eslint-env jest */

const {
  parseSubtitleLanguages,
  isExpandableLanguageCode,
  isPlainLanguageCode,
} = require('../subtitleLanguages');

describe('subtitleLanguages', () => {
  describe('parseSubtitleLanguages', () => {
    it('splits the configured comma-separated list', () => {
      expect(parseSubtitleLanguages('en,es')).toEqual(['en', 'es']);
    });

    it('trims whitespace around hand-edited entries', () => {
      expect(parseSubtitleLanguages(' en , es ')).toEqual(['en', 'es']);
    });

    it('falls back to English when nothing is configured', () => {
      expect(parseSubtitleLanguages(null)).toEqual(['en']);
      expect(parseSubtitleLanguages('')).toEqual(['en']);
    });

    it('falls back to English when the value is only separators and spaces', () => {
      expect(parseSubtitleLanguages(' , ')).toEqual(['en']);
    });
  });

  describe('isExpandableLanguageCode', () => {
    it('treats two- and three-letter codes as bare language codes', () => {
      expect(isExpandableLanguageCode('en')).toBe(true);
      expect(isExpandableLanguageCode('fil')).toBe(true);
    });

    it('never treats the yt-dlp "all" alias as a language code', () => {
      expect(isExpandableLanguageCode('all')).toBe(false);
    });

    it('leaves regional codes, the -orig option, exclusions and regexes alone', () => {
      expect(isExpandableLanguageCode('en-orig')).toBe(false);
      expect(isExpandableLanguageCode('pt-BR')).toBe(false);
      expect(isExpandableLanguageCode('-live_chat')).toBe(false);
      expect(isExpandableLanguageCode('en.*')).toBe(false);
    });
  });

  describe('isPlainLanguageCode', () => {
    it('accepts bare codes and codes with subtags', () => {
      expect(isPlainLanguageCode('en')).toBe(true);
      expect(isPlainLanguageCode('fil')).toBe(true);
      expect(isPlainLanguageCode('en-orig')).toBe(true);
      expect(isPlainLanguageCode('pt-BR')).toBe(true);
      expect(isPlainLanguageCode('zh-Hans')).toBe(true);
    });

    it('rejects the "all" alias, exclusions and regexes', () => {
      expect(isPlainLanguageCode('all')).toBe(false);
      expect(isPlainLanguageCode('-live_chat')).toBe(false);
      expect(isPlainLanguageCode('en.*')).toBe(false);
      expect(isPlainLanguageCode('en(-x)?')).toBe(false);
    });
  });
});
