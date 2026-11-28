import { VideoData } from '../../../../types/VideoData';
import { videoDataToModalData } from '../videoDataToModalData';

const video = (overrides: Partial<VideoData> = {}): VideoData => ({
  id: 7,
  youtubeId: 'abc123',
  youTubeChannelName: 'Channel',
  youTubeVideoName: 'Video',
  duration: 120,
  timeCreated: '2026-01-15T09:00:00Z',
  originalDate: '20260110',
  description: null,
  ...overrides,
});

describe('videoDataToModalData', () => {
  test('maps a library row that has no file path to a downloaded video', () => {
    expect(videoDataToModalData(video())).toMatchObject({
      youtubeId: 'abc123',
      title: 'Video',
      thumbnailUrl: '/images/videothumb-abc123.jpg',
      databaseId: 7,
      status: 'downloaded',
      isDownloaded: true,
    });
  });

  test('with requireFile, a row counts as downloaded only once it has a file', () => {
    expect(videoDataToModalData(video(), { requireFile: true })).toMatchObject({
      status: 'never_downloaded',
      isDownloaded: false,
    });
    expect(videoDataToModalData(video({ filePath: '/videos/a.mp4' }), { requireFile: true })).toMatchObject({
      status: 'downloaded',
      isDownloaded: true,
    });
  });

  test('reports a removed row by why it was removed', () => {
    const missing = video({ filePath: '/videos/a.mp4', removed: true, removed_reason: 'not_found' });

    expect(videoDataToModalData(missing)).toMatchObject({ status: 'missing', isDownloaded: false });
  });
});
