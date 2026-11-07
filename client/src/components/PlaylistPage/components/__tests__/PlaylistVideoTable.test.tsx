import { render, screen, fireEvent } from '@testing-library/react';
import PlaylistVideoTable from '../PlaylistVideoTable';
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
  onSelectAll: jest.fn(),
  onClearSelection: jest.fn(),
};

describe('PlaylistVideoTable selection', () => {
  test('toggles selection when a downloadable row checkbox is clicked', () => {
    const onToggle = jest.fn();
    render(
      <PlaylistVideoTable {...baseProps} onToggle={onToggle} videos={[makeVideo({ youtube_id: 'dl1' })]} />
    );
    const checkboxes = screen.getAllByRole('checkbox');
    // [0] is the header select-all, [1] is the row checkbox.
    fireEvent.click(checkboxes[1]);
    expect(onToggle).toHaveBeenCalledWith('dl1');
  });

  test('renders a row checkbox for a downloaded video so it can be deleted', () => {
    const onToggle = jest.fn();
    render(
      <PlaylistVideoTable
        {...baseProps}
        onToggle={onToggle}
        videos={[makeVideo({ youtube_id: 'done', title: 'Done', downloaded: true })]}
      />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Done' }));
    expect(onToggle).toHaveBeenCalledWith('done');
  });

  test('does not render a row checkbox for a never-downloaded video removed on YouTube', () => {
    render(
      <PlaylistVideoTable {...baseProps} videos={[makeVideo({ youtube_id: 'gone', title: 'Gone', youtube_removed: true })]} />
    );
    expect(screen.queryByRole('checkbox', { name: 'Select Gone' })).not.toBeInTheDocument();
  });

  test('header select-all selects downloaded and not-downloaded videos', () => {
    const onSelectAll = jest.fn();
    render(
      <PlaylistVideoTable
        {...baseProps}
        onSelectAll={onSelectAll}
        videos={[
          makeVideo({ youtube_id: 'a' }),
          makeVideo({ youtube_id: 'b', downloaded: true }),
          makeVideo({ youtube_id: 'c', youtube_removed: true }),
        ]}
      />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all videos' }));
    expect(onSelectAll).toHaveBeenCalledWith(['a', 'b']);
  });

  test('shows the channel under the title instead of in its own column', () => {
    render(<PlaylistVideoTable {...baseProps} videos={[makeVideo({ channel_name: 'Some Channel' })]} />);
    expect(screen.getByText('Some Channel')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Channel' })).not.toBeInTheDocument();
  });

  test('has no separate Actions column', () => {
    render(<PlaylistVideoTable {...baseProps} videos={[makeVideo()]} />);
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
  });

  test('shows italic Unknown when published_at is missing', () => {
    render(<PlaylistVideoTable {...baseProps} videos={[makeVideo()]} />);
    const el = screen.getByText('Unknown');
    expect(el.tagName.toLowerCase()).toBe('em');
  });

  test('renders the Exclude action and fires onIgnore', () => {
    const onIgnore = jest.fn();
    render(<PlaylistVideoTable {...baseProps} onIgnore={onIgnore} videos={[makeVideo({ youtube_id: 'x', title: 'Clip X' })]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Exclude Clip X' }));
    expect(onIgnore).toHaveBeenCalledWith('x');
  });

  test('renders the Include action for an excluded video and fires onUnignore', () => {
    const onUnignore = jest.fn();
    render(
      <PlaylistVideoTable
        {...baseProps}
        onUnignore={onUnignore}
        videos={[makeVideo({ youtube_id: 'x', title: 'Clip X', ignored: true })]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Include Clip X' }));
    expect(onUnignore).toHaveBeenCalledWith('x');
  });

  test('header checkbox calls onClearSelection when all are already selected', () => {
    const onClearSelection = jest.fn();
    render(
      <PlaylistVideoTable
        {...baseProps}
        isSelected={() => true}
        onClearSelection={onClearSelection}
        videos={[makeVideo({ youtube_id: 'a' })]}
      />
    );
    const header = screen.getAllByRole('checkbox')[0];
    fireEvent.click(header);
    expect(onClearSelection).toHaveBeenCalled();
  });

  describe('downloaded status', () => {
    test('renders the download format indicator (size + format icon) for a downloaded video', () => {
      render(
        <PlaylistVideoTable
          {...baseProps}
          videos={[makeVideo({ youtube_id: 'done', downloaded: true, file_path: '/data/v.mp4', file_size: 1024 * 1024 * 50 })]}
        />
      );
      expect(screen.getByTestId('download-format-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('VideoFormatIcon')).toBeInTheDocument();
      expect(screen.getByText(/50/)).toBeInTheDocument();
      expect(screen.queryByText('Downloaded')).not.toBeInTheDocument();
    });

    test('shows both format icons when a downloaded video also has an audio file', () => {
      render(
        <PlaylistVideoTable
          {...baseProps}
          videos={[makeVideo({
            youtube_id: 'both', downloaded: true,
            file_path: '/data/v.mp4', file_size: 1024 * 1024 * 50,
            audio_file_path: '/data/v.m4a', audio_file_size: 1024 * 1024 * 5,
          })]}
        />
      );
      expect(screen.getByTestId('VideoFormatIcon')).toBeInTheDocument();
      expect(screen.getByTestId('AudioFormatIcon')).toBeInTheDocument();
    });

    test('shows the status chip (not the indicator) for a tracked video', () => {
      render(<PlaylistVideoTable {...baseProps} videos={[makeVideo({ youtube_id: 'trk' })]} />);
      expect(screen.getByText('Tracked')).toBeInTheDocument();
      expect(screen.queryByTestId('download-format-indicator')).not.toBeInTheDocument();
    });

    test('keeps the Excluded chip visible next to the indicator for a downloaded excluded video', () => {
      render(
        <PlaylistVideoTable
          {...baseProps}
          videos={[makeVideo({
            youtube_id: 'exdl', downloaded: true, ignored: true,
            file_path: '/data/v.mp4', file_size: 1024,
          })]}
        />
      );
      expect(screen.getByTestId('download-format-indicator')).toBeInTheDocument();
      expect(screen.getByText('Excluded')).toBeInTheDocument();
    });

    test('renders a Watched chip for a video watched on a server', () => {
      render(
        <PlaylistVideoTable
          {...baseProps}
          videos={[makeVideo({
            youtube_id: 'seen', downloaded: true,
            file_path: '/data/v.mp4', file_size: 1024, watched_by: ['plex'],
          })]}
        />
      );
      expect(screen.getByText('Watched')).toBeInTheDocument();
    });

    test('does not render a Watched chip when watched_by is empty', () => {
      render(
        <PlaylistVideoTable
          {...baseProps}
          videos={[makeVideo({ youtube_id: 'done', downloaded: true, file_path: '/data/v.mp4', file_size: 1024 })]}
        />
      );
      expect(screen.queryByText('Watched')).not.toBeInTheDocument();
    });
  });
});
