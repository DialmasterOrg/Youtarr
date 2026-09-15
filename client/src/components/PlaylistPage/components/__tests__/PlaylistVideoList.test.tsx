import { act, render, screen, fireEvent } from '@testing-library/react';
import PlaylistVideoList from '../PlaylistVideoList';
import { PlaylistSortOrder } from '../../../../hooks/usePlaylistDetail';
import { PlaylistVideo } from '../../../../types/playlist';

jest.mock('../../../../hooks/useMediaQuery', () => ({
  useMediaQuery: jest.fn(() => false),
}));

const { useMediaQuery } = require('../../../../hooks/useMediaQuery');

function makeVideo(overrides: Partial<PlaylistVideo> = {}): PlaylistVideo {
  return {
    id: 1, playlist_id: 'PL1', youtube_id: 'v1', position: 1, added_at: null,
    channel_id: null, ignored: false, ignored_at: null, title: 'Title',
    channel_name: 'Chan', duration: 60, published_at: null, thumbnail: null,
    downloaded: false, previously_downloaded: false, youtube_removed: false, video_id: null, file_path: null,
    file_size: null, audio_file_path: null, audio_file_size: null, ...overrides,
  };
}

const baseProps = {
  onIgnore: jest.fn(),
  onUnignore: jest.fn(),
  onVideoClick: jest.fn(),
  pendingId: null,
  isSelected: () => false,
  onToggle: jest.fn(),
  onSelectAll: jest.fn(),
  onClearSelection: jest.fn(),
};

describe('PlaylistVideoList', () => {
  beforeEach(() => {
    useMediaQuery.mockReturnValue(false);
  });

  test('shows the empty message when there are no videos and not loading', () => {
    render(<PlaylistVideoList {...baseProps} videos={[]} loading={false} />);
    expect(screen.getByText(/No videos yet/i)).toBeInTheDocument();
  });

  test('renders the desktop table when not mobile', () => {
    useMediaQuery.mockReturnValue(false);
    render(<PlaylistVideoList {...baseProps} videos={[makeVideo()]} loading={false} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  test('renders cards (no table) when mobile', () => {
    useMediaQuery.mockReturnValue(true);
    render(<PlaylistVideoList {...baseProps} videos={[makeVideo({ title: 'Mobile Vid' })]} loading={false} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Mobile Vid')).toBeInTheDocument();
  });

  const sorts: PlaylistSortOrder[] = ['asc', 'recent', 'downloaded', 'published', 'desc'];
  const dateCases = [false, true].flatMap((cards) => [false, true].flatMap((downloaded) =>
    sorts.map((sortOrder) => ({
      cards, downloaded, sortOrder,
      discoveryLabels: Number(sortOrder === 'recent'),
      downloadLabels: Number(sortOrder === 'downloaded' && downloaded),
    }))));

  test.each(dateCases)('keeps publication visible: $sortOrder, cards=$cards, downloaded=$downloaded', ({ cards, downloaded, sortOrder, discoveryLabels, downloadLabels }) => {
    useMediaQuery.mockReturnValue(cards);
    const videos = [makeVideo({
      published_at: '20260827', first_seen_at: '2026-09-09T12:00:00Z', downloaded_at: '2026-09-10T12:00:00Z',
      downloaded, file_path: downloaded ? '/data/v1.mp4' : null,
    })];
    render(<PlaylistVideoList {...baseProps} videos={videos} loading={false} sortOrder={sortOrder} />);
    expect(screen.getByText('Published:')).toBeVisible();
    expect(screen.getByText('2026-08-27')).toBeVisible();
    expect(screen.queryAllByText('Discovered:')).toHaveLength(discoveryLabels);
    expect(screen.queryAllByText('Downloaded:')).toHaveLength(downloadLabels);
  });

  test.each([false, true])('shows unknown discovery dates without hiding publication (cards=%s)', (cards) => {
    useMediaQuery.mockReturnValue(cards);
    render(<PlaylistVideoList {...baseProps} videos={[makeVideo({ published_at: '20260827' })]} loading={false} sortOrder="recent" />);
    expect(screen.getByText('2026-08-27')).toBeVisible();
    expect(screen.getByText('Discovered:')).toBeVisible();
    expect(screen.getByText('Unknown')).toBeVisible();
  });

  test.each([false, true])('expanding a timestamp does not open the video (cards=%s)', (cards) => {
    useMediaQuery.mockReturnValue(cards);
    const onVideoClick = jest.fn();
    const seen = new Date('2026-09-09T12:00:00Z');
    render(<PlaylistVideoList {...baseProps} onVideoClick={onVideoClick}
      videos={[makeVideo({ published_at: '20260827', first_seen_at: seen.toISOString() })]} loading={false} sortOrder="recent" />);
    const fullDate = seen.toLocaleString(undefined, { timeZoneName: 'short' });
    fireEvent.click(screen.getByLabelText(`Discovered: ${fullDate}. Show full timestamp`));
    expect(screen.getByText(fullDate)).toBeVisible();
    expect(onVideoClick).not.toHaveBeenCalled();
    expect(screen.getByText('2026-08-27')).toBeVisible();
  });
});


describe('PlaylistVideoList container sizing', () => {
  const originalObserver = global.ResizeObserver;
  let onResize: ResizeObserverCallback;
  let observer: ResizeObserver;
  let disconnect: jest.Mock;

  beforeEach(() => {
    useMediaQuery.mockReturnValue(false);
    disconnect = jest.fn();
    global.ResizeObserver = jest.fn((callback: ResizeObserverCallback) => {
      onResize = callback;
      observer = { observe: jest.fn(), unobserve: jest.fn(), disconnect };
      return observer;
    });
  });

  afterEach(() => {
    global.ResizeObserver = originalObserver;
  });

  const resize = (width: number) => {
    act(() => onResize([{ contentRect: { width } } as ResizeObserverEntry], observer));
  };

  test('uses the available container width to switch between cards and a table', () => {
    render(<PlaylistVideoList {...baseProps} videos={[makeVideo({ published_at: '20260827' })]} loading={false} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    resize(900);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('2026-08-27')).toBeVisible();
    resize(1200);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  test('ignores zero-width observations and disconnects on unmount', () => {
    const { unmount } = render(<PlaylistVideoList {...baseProps} videos={[makeVideo()]} loading={false} />);
    resize(0);
    expect(screen.getByRole('table')).toBeInTheDocument();
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
