const {
  VIDEO_ID_PATTERN,
  buildWatchUrl,
  buildChannelUrl,
  buildVideoThumbnailUrl,
} = require('../youtube');

describe('constants/youtube', () => {
  it('accepts only 11 character video ids', () => {
    expect(VIDEO_ID_PATTERN.test('dQw4w9WgXcQ')).toBe(true);
    expect(VIDEO_ID_PATTERN.test('a-b_c-d_e-f')).toBe(true);
    expect(VIDEO_ID_PATTERN.test('dQw4w9WgXc')).toBe(false);
    expect(VIDEO_ID_PATTERN.test('dQw4w9WgXcQQ')).toBe(false);
    expect(VIDEO_ID_PATTERN.test('dQw4w9WgXc!')).toBe(false);
    expect(VIDEO_ID_PATTERN.test('dQw4w9WgXcQ\n')).toBe(false);
  });

  it('builds watch and channel URLs', () => {
    expect(buildWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(buildChannelUrl('UCuAXFkgsw1L7xaCfnd5JJOw'))
      .toBe('https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw');
  });

  it('builds a thumbnail URL, hqdefault unless a size is given', () => {
    expect(buildVideoThumbnailUrl('dQw4w9WgXcQ')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    expect(buildVideoThumbnailUrl('dQw4w9WgXcQ', 'mqdefault'))
      .toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
  });
});
