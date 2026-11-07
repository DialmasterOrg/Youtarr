import { render, screen } from '@testing-library/react';
import { isDeletable, isDownloadable, isSelectable, statusLabel, PublishedDate, toDownloadFileProps, toModalData } from '../playlistVideoHelpers';
import { PlaylistVideo } from '../../../../types/playlist';

function makeVideo(overrides: Partial<PlaylistVideo> = {}): PlaylistVideo {
  return {
    id: 1,
    playlist_id: 'PL1',
    youtube_id: 'v1',
    position: 1,
    added_at: null,
    channel_id: null,
    ignored: false,
    ignored_at: null,
    title: 'Title',
    channel_name: 'Chan',
    duration: 60,
    published_at: null,
    thumbnail: null,
    downloaded: false,
    previously_downloaded: false,
    youtube_removed: false,
    video_id: null,
    file_path: null,
    file_size: null,
    audio_file_path: null,
    audio_file_size: null,
    ...overrides,
  };
}

describe('isDownloadable', () => {
  test('true for a tracked, not-downloaded, not-removed video', () => {
    expect(isDownloadable(makeVideo())).toBe(true);
  });
  test('false when already downloaded', () => {
    expect(isDownloadable(makeVideo({ downloaded: true }))).toBe(false);
  });
  test('false when removed on YouTube', () => {
    expect(isDownloadable(makeVideo({ youtube_removed: true }))).toBe(false);
  });
  test('true even when ignored (explicit selection overrides ignore)', () => {
    expect(isDownloadable(makeVideo({ ignored: true }))).toBe(true);
  });
});

describe('isDeletable', () => {
  test('true for a downloaded video', () => {
    expect(isDeletable(makeVideo({ downloaded: true }))).toBe(true);
  });
  test('false for a video with no file', () => {
    expect(isDeletable(makeVideo({ previously_downloaded: true }))).toBe(false);
  });
  test('false while the video is downloading again', () => {
    expect(isDeletable(makeVideo({ downloaded: true, activity: 'downloading' }))).toBe(false);
  });
  test('true for a downloaded video YouTube has since removed', () => {
    expect(isDeletable(makeVideo({ downloaded: true, youtube_removed: true }))).toBe(true);
  });
});

describe('isSelectable', () => {
  test('true for a video that can be downloaded', () => {
    expect(isSelectable(makeVideo())).toBe(true);
  });
  test('true for a video that can be deleted', () => {
    expect(isSelectable(makeVideo({ downloaded: true }))).toBe(true);
  });
  test('false for a never-downloaded video removed on YouTube', () => {
    expect(isSelectable(makeVideo({ youtube_removed: true }))).toBe(false);
  });
  test('false while the video is queued', () => {
    expect(isSelectable(makeVideo({ activity: 'queued' }))).toBe(false);
  });
});

describe('statusLabel', () => {
  test('returns Downloaded for a downloaded video', () => {
    expect(statusLabel(makeVideo({ downloaded: true })).label).toBe('Downloaded');
  });
  test('returns Excluded (takes priority) for an excluded video', () => {
    expect(statusLabel(makeVideo({ ignored: true, downloaded: true }))).toEqual({
      label: 'Excluded',
      color: 'warning',
    });
  });
  test('returns Removed on YT for a removed video', () => {
    expect(statusLabel(makeVideo({ youtube_removed: true }))).toEqual({
      label: 'Removed on YT',
      color: 'error',
    });
  });
  test('returns Missing for a previously-downloaded video whose file was not found', () => {
    expect(statusLabel(makeVideo({ previously_downloaded: true, removed_reason: 'not_found', file_path: '/d/v.mp4' }))).toMatchObject({
      label: 'Missing',
      color: 'error',
    });
  });
  test('explains a missing video with the path Youtarr looked at', () => {
    const { tooltip } = statusLabel(makeVideo({ previously_downloaded: true, removed_reason: 'not_found', file_path: '/d/v.mp4' }));
    render(<>{tooltip}</>);
    expect(screen.getByRole('code')).toHaveTextContent('/d/v.mp4');
  });
  test('returns a neutral Deleted for a previously-downloaded video Youtarr removed, explaining it', () => {
    const status = statusLabel(makeVideo({ previously_downloaded: true, removed_reason: 'auto_removal', removed_detail: 'older than 30 days' }));
    expect(status).toMatchObject({ label: 'Deleted', color: 'default' });
    const { container } = render(<>{status.tooltip}</>);
    expect(container).toHaveTextContent('Deleted by automatic cleanup (older than 30 days). It can be downloaded again.');
  });
  test('treats a previously-downloaded video without a recorded reason as Deleted', () => {
    const status = statusLabel(makeVideo({ previously_downloaded: true }));
    expect(status).toMatchObject({ label: 'Deleted', color: 'default' });
    const { container } = render(<>{status.tooltip}</>);
    expect(container).toHaveTextContent('Removed before Youtarr recorded why. It can be downloaded again.');
  });
  test('returns Tracked for a plain tracked video', () => {
    expect(statusLabel(makeVideo())).toEqual({ label: 'Tracked', color: 'default' });
  });
});

describe('toDownloadFileProps', () => {
  test('maps snake_case file fields to DownloadFormatIndicator camelCase props', () => {
    const v = makeVideo({
      file_path: '/data/video.mp4',
      file_size: 1000,
      audio_file_path: '/data/audio.m4a',
      audio_file_size: 500,
      video_resolution: '1920x1080',
    });
    expect(toDownloadFileProps(v)).toEqual({
      filePath: '/data/video.mp4',
      audioFilePath: '/data/audio.m4a',
      fileSize: 1000,
      audioFileSize: 500,
      videoResolution: '1920x1080',
    });
  });

  test('maps a missing video_resolution to null', () => {
    const v = makeVideo({ file_path: '/data/video.mp4', file_size: 1000 });
    expect(toDownloadFileProps(v).videoResolution).toBeNull();
  });

  test('preserves nulls when no audio file exists', () => {
    const v = makeVideo({ file_path: '/data/video.mp4', file_size: 1000 });
    expect(toDownloadFileProps(v)).toEqual({
      filePath: '/data/video.mp4',
      audioFilePath: null,
      fileSize: 1000,
      audioFileSize: null,
      videoResolution: null,
    });
  });
});

describe('toModalData', () => {
  test('shows a present file as downloaded even when YouTube removed the video', () => {
    const data = toModalData(makeVideo({ downloaded: true, youtube_removed: true, file_path: '/d/Chan/v [v1].mp4' }));
    expect(data.status).toBe('downloaded');
    expect(data.isDownloaded).toBe(true);
  });

  test('shows a previously downloaded video whose file was not found as missing, YouTube-removed or not', () => {
    const data = toModalData(makeVideo({ previously_downloaded: true, youtube_removed: true, removed_reason: 'not_found' }));
    expect(data.status).toBe('missing');
  });

  test('shows a previously downloaded video Youtarr removed as deleted', () => {
    expect(toModalData(makeVideo({ previously_downloaded: true, removed_reason: 'user_deleted' })).status).toBe('deleted');
  });

  test('shows a never downloaded video that YouTube removed as missing', () => {
    expect(toModalData(makeVideo({ youtube_removed: true })).status).toBe('missing');
  });

  test('shows a tracked video as never downloaded', () => {
    expect(toModalData(makeVideo()).status).toBe('never_downloaded');
  });
});

describe('PublishedDate', () => {
  test('renders an italic Unknown when there is no date', () => {
    render(<PublishedDate value={null} />);
    const el = screen.getByText('Unknown');
    expect(el.tagName.toLowerCase()).toBe('em');
  });
  test('renders the formatted date when present', () => {
    render(<PublishedDate value="20240115" />);
    expect(screen.getByText('2024-01-15')).toBeInTheDocument();
  });
});
