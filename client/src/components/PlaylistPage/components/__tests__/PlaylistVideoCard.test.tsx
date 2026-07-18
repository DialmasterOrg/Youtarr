import { render, screen, fireEvent } from '@testing-library/react';
import PlaylistVideoCard from '../PlaylistVideoCard';
import { PlaylistVideo } from '../../../../types/playlist';

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
};

describe('PlaylistVideoCard', () => {
  test('renders the title', () => {
    render(<PlaylistVideoCard {...baseProps} video={makeVideo({ title: 'My Vid' })} />);
    expect(screen.getByText('My Vid')).toBeInTheDocument();
  });

  test('renders a checkbox and toggles for a downloadable video', () => {
    const onToggle = jest.fn();
    render(<PlaylistVideoCard {...baseProps} onToggle={onToggle} video={makeVideo({ youtube_id: 'dl1' })} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith('dl1');
  });

  test('renders no checkbox for an already-downloaded video', () => {
    render(<PlaylistVideoCard {...baseProps} video={makeVideo({ downloaded: true })} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  test('shows italic Unknown when there is no published date', () => {
    render(<PlaylistVideoCard {...baseProps} video={makeVideo()} />);
    expect(screen.getByText('Unknown').tagName.toLowerCase()).toBe('em');
  });

  test('fires onIgnore from the ignore button', () => {
    const onIgnore = jest.fn();
    render(<PlaylistVideoCard {...baseProps} onIgnore={onIgnore} video={makeVideo({ youtube_id: 'x' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ignore' }));
    expect(onIgnore).toHaveBeenCalledWith('x');
  });

  describe('downloaded status', () => {
    test('renders the download format indicator (size + format icon) for a downloaded video', () => {
      render(
        <PlaylistVideoCard
          {...baseProps}
          video={makeVideo({ downloaded: true, file_path: '/data/v.mp4', file_size: 1024 * 1024 * 50 })}
        />
      );
      expect(screen.getByTestId('download-format-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('VideoFormatIcon')).toBeInTheDocument();
      expect(screen.getByText(/50/)).toBeInTheDocument();
      expect(screen.queryByText('Downloaded')).not.toBeInTheDocument();
    });

    test('shows the status chip (not the indicator) for a tracked video', () => {
      render(<PlaylistVideoCard {...baseProps} video={makeVideo()} />);
      expect(screen.getByText('Tracked')).toBeInTheDocument();
      expect(screen.queryByTestId('download-format-indicator')).not.toBeInTheDocument();
    });

    test('renders a Watched chip for a video watched on a server', () => {
      render(
        <PlaylistVideoCard
          {...baseProps}
          video={makeVideo({ downloaded: true, file_path: '/data/v.mp4', watched_by: ['plex'] })}
        />
      );
      expect(screen.getByText('Watched')).toBeInTheDocument();
    });

    test('does not render a Watched chip when watched_by is empty', () => {
      render(
        <PlaylistVideoCard
          {...baseProps}
          video={makeVideo({ downloaded: true, file_path: '/data/v.mp4' })}
        />
      );
      expect(screen.queryByText('Watched')).not.toBeInTheDocument();
    });
  });
});
