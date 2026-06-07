import { render, screen } from '@testing-library/react';
import { isDownloadable, statusLabel, PublishedDate } from '../playlistVideoHelpers';
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
    youtube_removed: false,
    video_id: null,
    file_path: null,
    file_size: null,
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

describe('statusLabel', () => {
  test('returns Downloaded for a downloaded video', () => {
    expect(statusLabel(makeVideo({ downloaded: true })).label).toBe('Downloaded');
  });
  test('returns Ignored (takes priority) for an ignored video', () => {
    expect(statusLabel(makeVideo({ ignored: true, downloaded: true }))).toEqual({
      label: 'Ignored',
      color: 'warning',
    });
  });
  test('returns Removed on YT for a removed video', () => {
    expect(statusLabel(makeVideo({ youtube_removed: true }))).toEqual({
      label: 'Removed on YT',
      color: 'error',
    });
  });
  test('returns Tracked for a plain tracked video', () => {
    expect(statusLabel(makeVideo())).toEqual({ label: 'Tracked', color: 'default' });
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
