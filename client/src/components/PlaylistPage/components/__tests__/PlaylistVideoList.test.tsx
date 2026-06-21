import { render, screen } from '@testing-library/react';
import PlaylistVideoList from '../PlaylistVideoList';
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
});
