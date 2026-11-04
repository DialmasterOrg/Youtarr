/* eslint-env jest */
const { slimInfoJson } = require('../infoJsonSlimmer');

describe('slimInfoJson', () => {
  test('drops automatic_captions and keeps every other field', () => {
    const info = {
      id: 'abc123def45',
      title: 'Video',
      formats: [{ format_id: '137' }],
      subtitles: { en: [{ ext: 'vtt' }] },
      automatic_captions: { 'en-de': [{ ext: 'vtt' }] },
    };

    const result = slimInfoJson(info);

    expect(result).toEqual({
      id: 'abc123def45',
      title: 'Video',
      formats: [{ format_id: '137' }],
      subtitles: { en: [{ ext: 'vtt' }] },
    });
  });

  test('returns the same object so callers keep their reference', () => {
    const info = { id: 'abc123def45', automatic_captions: {} };

    expect(slimInfoJson(info)).toBe(info);
  });

  test('leaves a file without automatic_captions unchanged', () => {
    const info = { id: 'abc123def45', title: 'Video' };

    expect(slimInfoJson(info)).toEqual({ id: 'abc123def45', title: 'Video' });
  });

  test('passes null and undefined through', () => {
    expect(slimInfoJson(null)).toBeNull();
    expect(slimInfoJson(undefined)).toBeUndefined();
  });
});
