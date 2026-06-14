import { render, screen, fireEvent } from '@testing-library/react';
import PlaylistVideoTable from '../PlaylistVideoTable';
import { PlaylistVideo } from '../../../../types/playlist';

function makeVideo(overrides: Partial<PlaylistVideo> = {}): PlaylistVideo {
  return {
    id: 1, playlist_id: 'PL1', youtube_id: 'v1', position: 1, added_at: null,
    channel_id: null, ignored: false, ignored_at: null, title: 'Title',
    channel_name: 'Chan', duration: 60, published_at: null, thumbnail: null,
    downloaded: false, previously_downloaded: false, youtube_removed: false, video_id: null, file_path: null,
    file_size: null, ...overrides,
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

  test('does not render a row checkbox for an already-downloaded video', () => {
    render(
      <PlaylistVideoTable {...baseProps} videos={[makeVideo({ youtube_id: 'done', downloaded: true })]} />
    );
    // Only the header select-all checkbox exists.
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  test('header select-all selects all downloadable ids', () => {
    const onSelectAll = jest.fn();
    render(
      <PlaylistVideoTable
        {...baseProps}
        onSelectAll={onSelectAll}
        videos={[makeVideo({ youtube_id: 'a' }), makeVideo({ youtube_id: 'b', downloaded: true })]}
      />
    );
    const header = screen.getAllByRole('checkbox')[0];
    fireEvent.click(header);
    expect(onSelectAll).toHaveBeenCalledWith(['a']);
  });

  test('shows italic Unknown when published_at is missing', () => {
    render(<PlaylistVideoTable {...baseProps} videos={[makeVideo()]} />);
    const el = screen.getByText('Unknown');
    expect(el.tagName.toLowerCase()).toBe('em');
  });

  test('renders the Ignore action and fires onIgnore', () => {
    const onIgnore = jest.fn();
    render(<PlaylistVideoTable {...baseProps} onIgnore={onIgnore} videos={[makeVideo({ youtube_id: 'x' })]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ignore' }));
    expect(onIgnore).toHaveBeenCalledWith('x');
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
});
