import { channelVideoToModalData } from '../channelVideoModalData';
import { ChannelVideo } from '../../../types/ChannelVideo';

const video = (overrides: Partial<ChannelVideo> = {}): ChannelVideo => ({
  title: 'A video',
  youtube_id: 'abc123',
  publishedAt: '2023-01-01T00:00:00Z',
  thumbnail: 'https://i.ytimg.com/vi/abc123/mqdefault.jpg',
  added: false,
  duration: 300,
  media_type: 'video',
  live_status: null,
  ...overrides,
});

describe('channelVideoToModalData', () => {
  test('carries the video, its channel and its file details over', () => {
    const data = channelVideoToModalData(
      video({
        id: 42,
        added: true,
        filePath: '/videos/a.mp4',
        fileSize: 1024,
        protected: true,
        normalized_rating: 'PG',
        rating_source: 'manual',
      }),
      'Some Channel',
      'UC123'
    );

    expect(data).toMatchObject({
      youtubeId: 'abc123',
      title: 'A video',
      channelName: 'Some Channel',
      channelId: 'UC123',
      thumbnailUrl: 'https://i.ytimg.com/vi/abc123/mqdefault.jpg',
      duration: 300,
      publishedAt: '2023-01-01T00:00:00Z',
      databaseId: 42,
      isDownloaded: true,
      filePath: '/videos/a.mp4',
      fileSize: 1024,
      isProtected: true,
      normalizedRating: 'PG',
      ratingSource: 'manual',
    });
  });

  test('fills in the fields a never-downloaded video does not have', () => {
    const data = channelVideoToModalData(video({ media_type: null, publishedAt: undefined }), '', undefined);

    expect(data).toMatchObject({
      status: 'never_downloaded',
      mediaType: 'video',
      publishedAt: null,
      addedAt: null,
      channelId: null,
      databaseId: null,
      isDownloaded: false,
      filePath: null,
      fileSize: null,
      audioFilePath: null,
      audioFileSize: null,
      isProtected: false,
      isIgnored: false,
      membersAccess: null,
    });
  });

  test('does not count a video whose file is gone as downloaded', () => {
    const data = channelVideoToModalData(video({ added: true, removed: true }), 'Some Channel', 'UC123');

    expect(data.isDownloaded).toBe(false);
  });

  test('gives the saved status, not the download in progress', () => {
    const data = channelVideoToModalData(
      video({ ignored: true, activity: 'downloading' }),
      'Some Channel',
      'UC123'
    );

    expect(data).toMatchObject({ status: 'ignored', isIgnored: true });
  });
});
