import { youtubeChannelUrl, youtubePlaylistUrl, youtubeVideoUrl } from '../youtubeUrls';

describe('youtubeVideoUrl', () => {
  test('builds a watch URL from the video ID', () => {
    expect(youtubeVideoUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  test('leaves the dash and underscore of a video ID as they are', () => {
    expect(youtubeVideoUrl('a-b_c123XYZ')).toBe('https://www.youtube.com/watch?v=a-b_c123XYZ');
  });

  test('encodes characters that are unsafe in a query value', () => {
    expect(youtubeVideoUrl('a&b=c')).toBe('https://www.youtube.com/watch?v=a%26b%3Dc');
  });
});

describe('youtubeChannelUrl', () => {
  test('builds a channel URL from the channel ID', () => {
    expect(youtubeChannelUrl('UCabc_123-XYZ')).toBe('https://www.youtube.com/channel/UCabc_123-XYZ');
  });

  test('encodes characters that are unsafe in a path segment', () => {
    expect(youtubeChannelUrl('a/b?c')).toBe('https://www.youtube.com/channel/a%2Fb%3Fc');
  });
});

describe('youtubePlaylistUrl', () => {
  test('builds a playlist URL from the playlist ID', () => {
    expect(youtubePlaylistUrl('PLabc_123-XYZ')).toBe('https://www.youtube.com/playlist?list=PLabc_123-XYZ');
  });

  test('encodes characters that are unsafe in a query value', () => {
    expect(youtubePlaylistUrl('a&b=c')).toBe('https://www.youtube.com/playlist?list=a%26b%3Dc');
  });
});
