import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import VideoTableView from '../VideoTableView';
import { ChannelVideo } from '../../../types/ChannelVideo';
import { renderWithProviders } from '../../../test-utils';

// Mock StillLiveDot component
jest.mock('../StillLiveDot', () => ({
  __esModule: true,
  default: function MockStillLiveDot(props: { isMobile?: boolean; onMobileClick?: (message: string) => void }) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'still-live-dot' }, 'LIVE');
  }
}));

describe('VideoTableView Component', () => {
  const mockVideo: ChannelVideo = {
    title: 'Test Video Title',
    youtube_id: 'test123',
    publishedAt: '2023-01-15T10:30:00Z',
    thumbnail: 'https://i.ytimg.com/vi/test123/mqdefault.jpg',
    added: false,
    duration: 600,
    fileSize: 1024 * 1024 * 50, // 50MB
    media_type: 'video',
    live_status: null,
  };

  const defaultProps = {
    videos: [mockVideo],
    checkedBoxes: [],
    selectedForDeletion: [],
    sortBy: 'date' as const,
    sortOrder: 'desc' as const,
    onCheckChange: jest.fn(),
    onSelectAll: jest.fn(),
    onClearSelection: jest.fn(),
    onSortChange: jest.fn(),
    onToggleDeletion: jest.fn(),
    onToggleIgnore: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    });

    test('renders table headers', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      expect(screen.getByText('Thumbnail')).toBeInTheDocument();
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Published')).toBeInTheDocument();
      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText('Size')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    test('renders empty table when no videos', () => {
      renderWithProviders(<VideoTableView {...defaultProps} videos={[]} />);
      expect(screen.queryByText('Test Video Title')).not.toBeInTheDocument();
    });

    test('renders multiple videos', () => {
      const videos = [
        mockVideo,
        { ...mockVideo, youtube_id: 'test456', title: 'Second Video' },
        { ...mockVideo, youtube_id: 'test789', title: 'Third Video' },
      ];
      renderWithProviders(<VideoTableView {...defaultProps} videos={videos} />);
      expect(screen.getByText('Test Video Title')).toBeInTheDocument();
      expect(screen.getByText('Second Video')).toBeInTheDocument();
      expect(screen.getByText('Third Video')).toBeInTheDocument();
    });
  });

  describe('Video Data Display', () => {
    test('renders video thumbnail', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      const img = screen.getByAltText('Test Video Title');
      expect(img).toHaveAttribute('src', 'https://i.ytimg.com/vi/test123/mqdefault.jpg');
    });

    test('renders video title with HTML decoding', () => {
      const videoWithEncodedTitle = {
        ...mockVideo,
        title: 'Test &amp; Video &quot;Title&quot;',
      };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[videoWithEncodedTitle]} />);
      expect(screen.getByText('Test & Video "Title"')).toBeInTheDocument();
    });

    test('renders published date', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      expect(screen.getByText(/1\/15\/2023/)).toBeInTheDocument();
    });

    test('renders N/A for published date when video is a short', () => {
      const shortVideo = { ...mockVideo, media_type: 'short' };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[shortVideo]} />);
      const allNAs = screen.getAllByText('N/A');
      expect(allNAs.length).toBeGreaterThan(0);
    });

    test('renders N/A for published date when publishedAt is null', () => {
      const videoNoDate = { ...mockVideo, publishedAt: null };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[videoNoDate]} />);
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    test('renders N/A for published date when publishedAt is undefined', () => {
      const videoNoDate = { ...mockVideo, publishedAt: undefined };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[videoNoDate]} />);
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    test('renders duration for regular videos', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      // Duration is 600 seconds = 10 minutes
      expect(screen.getByText('10m')).toBeInTheDocument();
    });

    test('renders N/A for short videos duration', () => {
      const shortVideo = { ...mockVideo, media_type: 'short' };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[shortVideo]} />);
      const allNAs = screen.getAllByText('N/A');
      // Shorts should have N/A for both published date and duration
      expect(allNAs.length).toBeGreaterThanOrEqual(2);
    });

    test('renders file size when available', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      expect(screen.getByText(/50/)).toBeInTheDocument();
    });

    test('renders dash when file size is not available', () => {
      const videoNoSize = { ...mockVideo, fileSize: undefined };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[videoNoSize]} />);
      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });

  describe('Video Status', () => {
    test('renders "Not Downloaded" status for never downloaded video', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      expect(screen.getByText('Not Downloaded')).toBeInTheDocument();
    });

    test('renders "Downloaded" status for downloaded video', () => {
      const downloadedVideo = { ...mockVideo, added: true, removed: false };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[downloadedVideo]} />);
      expect(screen.getByText('Downloaded')).toBeInTheDocument();
    });

    test('renders "Missing" status for removed video', () => {
      const removedVideo = { ...mockVideo, added: true, removed: true };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[removedVideo]} />);
      expect(screen.getByText('Missing')).toBeInTheDocument();
    });

    test('renders "Members Only" status for subscriber-only video', () => {
      const membersOnlyVideo = { ...mockVideo, availability: 'subscriber_only' };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[membersOnlyVideo]} />);
      expect(screen.getByText('Members Only')).toBeInTheDocument();
    });
  });

  describe('Media Type Indicators', () => {
    test('renders short chip for short videos', () => {
      const shortVideo = { ...mockVideo, media_type: 'short' };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[shortVideo]} />);
      expect(screen.getByText('Short')).toBeInTheDocument();
    });

    test('renders live chip for livestream videos', () => {
      const livestreamVideo = { ...mockVideo, media_type: 'livestream' };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[livestreamVideo]} />);
      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    test('does not render media type chip for regular videos', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      expect(screen.queryByText('Short')).not.toBeInTheDocument();
      expect(screen.queryByText('Live')).not.toBeInTheDocument();
    });
  });

  describe('YouTube Removed Banner', () => {
    test('shows removed banner when youtube_removed is true', () => {
      const removedVideo = { ...mockVideo, youtube_removed: true };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[removedVideo]} />);
      expect(screen.getByText('Removed From YouTube')).toBeInTheDocument();
    });

    test('does not show removed banner when youtube_removed is false', () => {
      const notRemovedVideo = { ...mockVideo, youtube_removed: false };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[notRemovedVideo]} />);
      expect(screen.queryByText('Removed From YouTube')).not.toBeInTheDocument();
    });

    test('does not show removed banner when youtube_removed is undefined', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      expect(screen.queryByText('Removed From YouTube')).not.toBeInTheDocument();
    });
  });

  describe('Still Live Videos', () => {
    test('renders StillLiveDot for videos with live_status is_live', () => {
      const liveVideo = { ...mockVideo, live_status: 'is_live' };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[liveVideo]} />);
      expect(screen.getByTestId('still-live-dot')).toBeInTheDocument();
    });

    test('renders StillLiveDot for videos with live_status is_upcoming', () => {
      const upcomingVideo = { ...mockVideo, live_status: 'is_upcoming' };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[upcomingVideo]} />);
      expect(screen.getByTestId('still-live-dot')).toBeInTheDocument();
    });

    test('does not render StillLiveDot for videos with live_status was_live', () => {
      const wasLiveVideo = { ...mockVideo, live_status: 'was_live' };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[wasLiveVideo]} />);
      expect(screen.queryByTestId('still-live-dot')).not.toBeInTheDocument();
    });

    test('does not render StillLiveDot for videos with null live_status', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      expect(screen.queryByTestId('still-live-dot')).not.toBeInTheDocument();
    });

    test('does not render checkbox for still live videos', () => {
      const liveVideo = { ...mockVideo, live_status: 'is_live' };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[liveVideo]} />);
      const checkboxes = screen.getAllByRole('checkbox');
      // Only the header checkbox should be present
      expect(checkboxes).toHaveLength(1);
    });

    test('passes onMobileTooltip to StillLiveDot component', () => {
      const onMobileTooltip = jest.fn();
      const liveVideo = { ...mockVideo, live_status: 'is_live' };

      renderWithProviders(
        <VideoTableView
          {...defaultProps}
          videos={[liveVideo]}
          onMobileTooltip={onMobileTooltip}
        />
      );

      expect(screen.getByTestId('still-live-dot')).toBeInTheDocument();
    });
  });

  describe('Header Checkbox', () => {
    test('renders header checkbox', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    test('header checkbox is checked when all videos are selected', () => {
      renderWithProviders(
        <VideoTableView {...defaultProps} checkedBoxes={['test123']} />
      );
      const checkboxes = screen.getAllByRole('checkbox');
      const headerCheckbox = checkboxes[0];
      expect(headerCheckbox).toBeChecked();
    });

    test('header checkbox is unchecked when no videos are selected', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      const checkboxes = screen.getAllByRole('checkbox');
      const headerCheckbox = checkboxes[0];
      expect(headerCheckbox).not.toBeChecked();
    });

    test('header checkbox is indeterminate when some videos are selected', () => {
      const videos = [
        mockVideo,
        { ...mockVideo, youtube_id: 'test456', title: 'Second Video' },
      ];
      renderWithProviders(
        <VideoTableView {...defaultProps} videos={videos} checkedBoxes={['test123']} />
      );
      const checkboxes = screen.getAllByRole('checkbox');
      const headerCheckbox = checkboxes[0];
      // Testing for indeterminate state
      expect(headerCheckbox).toHaveAttribute('data-indeterminate', 'true');
    });

    test('header checkbox is unchecked when videos array is empty', () => {
      renderWithProviders(<VideoTableView {...defaultProps} videos={[]} />);
      const checkboxes = screen.getAllByRole('checkbox');
      const headerCheckbox = checkboxes[0];
      expect(headerCheckbox).not.toBeChecked();
    });

    test('calls onSelectAll when header checkbox is clicked while unchecked', async () => {
      const user = userEvent.setup();
      const onSelectAll = jest.fn();

      renderWithProviders(
        <VideoTableView {...defaultProps} onSelectAll={onSelectAll} />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      const headerCheckbox = checkboxes[0];
      await user.click(headerCheckbox);

      expect(onSelectAll).toHaveBeenCalledTimes(1);
    });

    test('calls onClearSelection when header checkbox is clicked while checked', async () => {
      const user = userEvent.setup();
      const onClearSelection = jest.fn();

      renderWithProviders(
        <VideoTableView
          {...defaultProps}
          checkedBoxes={['test123']}
          onClearSelection={onClearSelection}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      const headerCheckbox = checkboxes[0];
      await user.click(headerCheckbox);

      expect(onClearSelection).toHaveBeenCalledTimes(1);
    });
  });

  describe('Video Row Checkbox', () => {
    test('renders checkbox for never downloaded videos', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      const checkboxes = screen.getAllByRole('checkbox');
      // Header + 1 video checkbox
      expect(checkboxes).toHaveLength(2);
    });

    test('renders checkbox for missing videos', () => {
      const missingVideo = { ...mockVideo, added: true, removed: true };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[missingVideo]} />);
      const checkboxes = screen.getAllByRole('checkbox');
      // Header + 1 video checkbox
      expect(checkboxes).toHaveLength(2);
    });

    test('does not render checkbox for downloaded videos', () => {
      const downloadedVideo = { ...mockVideo, added: true, removed: false };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[downloadedVideo]} />);
      const checkboxes = screen.getAllByRole('checkbox');
      // Only header checkbox
      expect(checkboxes).toHaveLength(1);
    });

    test('does not render checkbox for members only videos', () => {
      const membersOnlyVideo = { ...mockVideo, availability: 'subscriber_only' };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[membersOnlyVideo]} />);
      const checkboxes = screen.getAllByRole('checkbox');
      // Only header checkbox
      expect(checkboxes).toHaveLength(1);
    });

    test('does not render checkbox for youtube removed videos', () => {
      const removedVideo = { ...mockVideo, youtube_removed: true };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[removedVideo]} />);
      const checkboxes = screen.getAllByRole('checkbox');
      // Only header checkbox
      expect(checkboxes).toHaveLength(1);
    });

    test('checkbox is checked when video is in checkedBoxes', () => {
      renderWithProviders(
        <VideoTableView {...defaultProps} checkedBoxes={['test123']} />
      );
      const checkboxes = screen.getAllByRole('checkbox');
      const videoCheckbox = checkboxes[1]; // Second checkbox (first is header)
      expect(videoCheckbox).toBeChecked();
    });

    test('checkbox is unchecked when video is not in checkedBoxes', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      const checkboxes = screen.getAllByRole('checkbox');
      const videoCheckbox = checkboxes[1]; // Second checkbox (first is header)
      expect(videoCheckbox).not.toBeChecked();
    });

    test('calls onCheckChange when checkbox is clicked', async () => {
      const user = userEvent.setup();
      const onCheckChange = jest.fn();

      renderWithProviders(
        <VideoTableView {...defaultProps} onCheckChange={onCheckChange} />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      const videoCheckbox = checkboxes[1]; // Second checkbox (first is header)
      await user.click(videoCheckbox);

      expect(onCheckChange).toHaveBeenCalledTimes(1);
      expect(onCheckChange).toHaveBeenCalledWith('test123', true);
    });

    test('calls onCheckChange with false when checked checkbox is clicked', async () => {
      const user = userEvent.setup();
      const onCheckChange = jest.fn();

      renderWithProviders(
        <VideoTableView
          {...defaultProps}
          checkedBoxes={['test123']}
          onCheckChange={onCheckChange}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      const videoCheckbox = checkboxes[1]; // Second checkbox (first is header)
      await user.click(videoCheckbox);

      expect(onCheckChange).toHaveBeenCalledWith('test123', false);
    });
  });

  describe('Delete Button', () => {
    test('renders delete button for downloaded videos', () => {
      const downloadedVideo = { ...mockVideo, added: true, removed: false };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[downloadedVideo]} />);
      expect(screen.getByTestId('DeleteIcon')).toBeInTheDocument();
    });

    test('does not render delete button for never downloaded videos', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      expect(screen.queryByTestId('DeleteIcon')).not.toBeInTheDocument();
    });

    test('does not render delete button for missing videos', () => {
      const missingVideo = { ...mockVideo, added: true, removed: true };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[missingVideo]} />);
      expect(screen.queryByTestId('DeleteIcon')).not.toBeInTheDocument();
    });

    test('calls onToggleDeletion when delete button is clicked', async () => {
      const user = userEvent.setup();
      const onToggleDeletion = jest.fn();
      const downloadedVideo = { ...mockVideo, added: true, removed: false };

      renderWithProviders(
        <VideoTableView
          {...defaultProps}
          videos={[downloadedVideo]}
          onToggleDeletion={onToggleDeletion}
        />
      );

      const deleteButton = screen.getByRole('button');
      await user.click(deleteButton);

      expect(onToggleDeletion).toHaveBeenCalledTimes(1);
      expect(onToggleDeletion).toHaveBeenCalledWith('test123');
    });

    test('delete button click stops propagation', async () => {
      const user = userEvent.setup();
      const onToggleDeletion = jest.fn();
      const onCheckChange = jest.fn();
      const downloadedVideo = { ...mockVideo, added: true, removed: false };

      renderWithProviders(
        <VideoTableView
          {...defaultProps}
          videos={[downloadedVideo]}
          onToggleDeletion={onToggleDeletion}
          onCheckChange={onCheckChange}
        />
      );

      const deleteButton = screen.getByRole('button');
      await user.click(deleteButton);

      expect(onToggleDeletion).toHaveBeenCalledTimes(1);
      expect(onCheckChange).not.toHaveBeenCalled();
    });
  });

  describe('Ignore/Unignore Button', () => {
    test('renders ignore button for never downloaded videos', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      const buttons = screen.getAllByRole('button', { name: /ignore/i });
      expect(buttons.length).toBeGreaterThan(0);
    });

    test('renders ignore button for missing videos', () => {
      const missingVideo = { ...mockVideo, added: true, removed: true };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[missingVideo]} />);
      const buttons = screen.getAllByRole('button', { name: /ignore/i });
      expect(buttons.length).toBeGreaterThan(0);
    });

    test('renders unignore button for ignored videos', () => {
      const ignoredVideo = { ...mockVideo, ignored: true };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[ignoredVideo]} />);
      const buttons = screen.getAllByRole('button', { name: /unignore/i });
      expect(buttons.length).toBeGreaterThan(0);
    });

    test('does not render ignore button for downloaded videos', () => {
      const downloadedVideo = { ...mockVideo, added: true, removed: false };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[downloadedVideo]} />);
      expect(screen.queryByRole('button', { name: /ignore/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /unignore/i })).not.toBeInTheDocument();
    });

    test('does not render ignore button for still live videos', () => {
      const liveVideo = { ...mockVideo, live_status: 'is_live' };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[liveVideo]} />);
      expect(screen.queryByRole('button', { name: /ignore/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /unignore/i })).not.toBeInTheDocument();
    });

    test('calls onToggleIgnore when ignore button is clicked', async () => {
      const user = userEvent.setup();
      const onToggleIgnore = jest.fn();

      renderWithProviders(
        <VideoTableView
          {...defaultProps}
          onToggleIgnore={onToggleIgnore}
        />
      );

      const ignoreButton = screen.getByRole('button', { name: /ignore/i });
      await user.click(ignoreButton);
      expect(onToggleIgnore).toHaveBeenCalledTimes(1);
      expect(onToggleIgnore).toHaveBeenCalledWith('test123');
    });

    test('calls onToggleIgnore when unignore button is clicked', async () => {
      const user = userEvent.setup();
      const onToggleIgnore = jest.fn();
      const ignoredVideo = { ...mockVideo, ignored: true };

      renderWithProviders(
        <VideoTableView
          {...defaultProps}
          videos={[ignoredVideo]}
          onToggleIgnore={onToggleIgnore}
        />
      );

      const unignoreButton = screen.getByRole('button', { name: /unignore/i });
      await user.click(unignoreButton);
      expect(onToggleIgnore).toHaveBeenCalledTimes(1);
      expect(onToggleIgnore).toHaveBeenCalledWith('test123');
    });

    test('ignore button click stops propagation', async () => {
      const user = userEvent.setup();
      const onToggleIgnore = jest.fn();
      const onCheckChange = jest.fn();

      renderWithProviders(
        <VideoTableView
          {...defaultProps}
          onToggleIgnore={onToggleIgnore}
          onCheckChange={onCheckChange}
        />
      );

      const ignoreButton = screen.getByRole('button', { name: /ignore/i });
      await user.click(ignoreButton);
      expect(onToggleIgnore).toHaveBeenCalledTimes(1);
      expect(onCheckChange).not.toHaveBeenCalled();
    });

    test('ignore button has correct title attribute', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      const ignoreButton = screen.getByRole('button', { name: /ignore/i });
      expect(ignoreButton).toHaveAttribute('title', 'Ignore');
    });

    test('unignore button has correct title attribute', () => {
      const ignoredVideo = { ...mockVideo, ignored: true };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[ignoredVideo]} />);
      const unignoreButton = screen.getByRole('button', { name: /unignore/i });
      expect(unignoreButton).toHaveAttribute('title', 'Unignore');
    });
  });

  describe('Ignored Video Status', () => {
    test('renders "Ignored" status for ignored videos', () => {
      const ignoredVideo = { ...mockVideo, ignored: true };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[ignoredVideo]} />);
      expect(screen.getByText('Ignored')).toBeInTheDocument();
    });

    test('ignored videos have reduced opacity', () => {
      const ignoredVideo = { ...mockVideo, ignored: true };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[ignoredVideo]} />);
      const rows = screen.getAllByRole('row');
      // Find the row containing the ignored video (skip header row)
      const videoRow = rows.find(row => row.textContent?.includes('Test Video Title'));
      expect(videoRow).toHaveStyle({ opacity: 0.7 });
    });

    test('ignored videos are selectable with checkbox', () => {
      const ignoredVideo = { ...mockVideo, ignored: true };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[ignoredVideo]} />);
      const checkboxes = screen.getAllByRole('checkbox');
      // Header + 1 video checkbox (ignored videos are selectable)
      expect(checkboxes).toHaveLength(2);
    });

    test('renders BlockIcon for ignored videos in status chip', () => {
      const ignoredVideo = { ...mockVideo, ignored: true };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[ignoredVideo]} />);
      expect(screen.getByTestId('BlockIcon')).toBeInTheDocument();
    });
  });

  describe('Ignore and Delete Button Interaction', () => {
    test('does not render both ignore and delete buttons on same video', () => {
      const downloadedVideo = { ...mockVideo, added: true, removed: false };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[downloadedVideo]} />);

      // Should have delete button
      expect(screen.getByTestId('DeleteIcon')).toBeInTheDocument();

      // Should not have ignore button
      expect(screen.queryByRole('button', { name: /ignore/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /unignore/i })).not.toBeInTheDocument();
    });

    test('renders ignore button for missing video, not delete button', () => {
      const missingVideo = { ...mockVideo, added: true, removed: true };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[missingVideo]} />);

      // Should have ignore button
      expect(screen.getByRole('button', { name: /ignore/i })).toBeInTheDocument();

      // Should not have delete button
      expect(screen.queryByTestId('DeleteIcon')).not.toBeInTheDocument();
    });

    test('renders unignore button for ignored missing video', () => {
      const ignoredMissingVideo = {
        ...mockVideo,
        added: true,
        removed: true,
        ignored: true
      };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[ignoredMissingVideo]} />);

      // Should have unignore button
      expect(screen.getByRole('button', { name: /unignore/i })).toBeInTheDocument();

      // Should not have delete button
      expect(screen.queryByTestId('DeleteIcon')).not.toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    test('displays sort indicator for title when sorted by title ascending', () => {
      renderWithProviders(
        <VideoTableView {...defaultProps} sortBy="title" sortOrder="asc" />
      );
      expect(screen.getByTestId('ArrowUpwardIcon')).toBeInTheDocument();
    });

    test('displays sort indicator for title when sorted by title descending', () => {
      renderWithProviders(
        <VideoTableView {...defaultProps} sortBy="title" sortOrder="desc" />
      );
      expect(screen.getByTestId('ArrowDownwardIcon')).toBeInTheDocument();
    });

    test('displays sort indicator for date when sorted by date ascending', () => {
      renderWithProviders(
        <VideoTableView {...defaultProps} sortBy="date" sortOrder="asc" />
      );
      expect(screen.getByTestId('ArrowUpwardIcon')).toBeInTheDocument();
    });

    test('displays sort indicator for date when sorted by date descending', () => {
      renderWithProviders(
        <VideoTableView {...defaultProps} sortBy="date" sortOrder="desc" />
      );
      expect(screen.getByTestId('ArrowDownwardIcon')).toBeInTheDocument();
    });

    test('displays sort indicator for duration when sorted by duration', () => {
      renderWithProviders(
        <VideoTableView {...defaultProps} sortBy="duration" sortOrder="asc" />
      );
      expect(screen.getByTestId('ArrowUpwardIcon')).toBeInTheDocument();
    });

    test('displays sort indicator for size when sorted by size', () => {
      renderWithProviders(
        <VideoTableView {...defaultProps} sortBy="size" sortOrder="desc" />
      );
      expect(screen.getByTestId('ArrowDownwardIcon')).toBeInTheDocument();
    });

    test('calls onSortChange when title header is clicked', async () => {
      const user = userEvent.setup();
      const onSortChange = jest.fn();

      renderWithProviders(
        <VideoTableView {...defaultProps} onSortChange={onSortChange} />
      );

      const titleHeader = screen.getByText('Title');
      await user.click(titleHeader);

      expect(onSortChange).toHaveBeenCalledWith('title');
    });

    test('calls onSortChange when published header is clicked', async () => {
      const user = userEvent.setup();
      const onSortChange = jest.fn();

      renderWithProviders(
        <VideoTableView {...defaultProps} onSortChange={onSortChange} />
      );

      const publishedHeader = screen.getByText('Published');
      await user.click(publishedHeader);

      expect(onSortChange).toHaveBeenCalledWith('date');
    });

    test('calls onSortChange when duration header is clicked', async () => {
      const user = userEvent.setup();
      const onSortChange = jest.fn();

      renderWithProviders(
        <VideoTableView {...defaultProps} onSortChange={onSortChange} />
      );

      const durationHeader = screen.getByText('Duration');
      await user.click(durationHeader);

      expect(onSortChange).toHaveBeenCalledWith('duration');
    });

    test('calls onSortChange when size header is clicked', async () => {
      const user = userEvent.setup();
      const onSortChange = jest.fn();

      renderWithProviders(
        <VideoTableView {...defaultProps} onSortChange={onSortChange} />
      );

      const sizeHeader = screen.getByText('Size');
      await user.click(sizeHeader);

      expect(onSortChange).toHaveBeenCalledWith('size');
    });
  });

  describe('Thumbnail Object Fit', () => {
    test('uses contain object fit for shorts', () => {
      const shortVideo = { ...mockVideo, media_type: 'short' };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[shortVideo]} />);
      const img = screen.getByAltText('Test Video Title');
      expect(img).toHaveStyle({ objectFit: 'contain' });
    });

    test('uses cover object fit for regular videos', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      const img = screen.getByAltText('Test Video Title');
      expect(img).toHaveStyle({ objectFit: 'cover' });
    });
  });

  describe('Edge Cases', () => {
    test('handles video with null duration', () => {
      const videoNoDuration = { ...mockVideo, duration: 0 };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[videoNoDuration]} />);
      expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    });

    test('handles video with long title', () => {
      const longTitleVideo = {
        ...mockVideo,
        title: 'A'.repeat(200),
      };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[longTitleVideo]} />);
      expect(screen.getByText('A'.repeat(200))).toBeInTheDocument();
    });

    test('handles video published in different year', () => {
      const oldVideo = { ...mockVideo, publishedAt: '2020-12-25T00:00:00Z' };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[oldVideo]} />);
      expect(screen.getByText(/2020/)).toBeInTheDocument();
    });

    test('handles video with very large file size', () => {
      const largeVideo = { ...mockVideo, fileSize: 1024 * 1024 * 1024 * 5.5 };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[largeVideo]} />);
      expect(screen.getByText(/GB/)).toBeInTheDocument();
    });

    test('handles video in both selectedForDeletion and checkedBoxes', () => {
      const downloadedVideo = { ...mockVideo, added: true, removed: false };
      renderWithProviders(
        <VideoTableView
          {...defaultProps}
          videos={[downloadedVideo]}
          selectedForDeletion={['test123']}
          checkedBoxes={['test123']}
        />
      );
      // Should show delete button since it's downloaded
      expect(screen.getByTestId('DeleteIcon')).toBeInTheDocument();
      // Should not show video checkbox since it's downloaded (only header checkbox)
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(1);
    });
  });

  describe('Accessibility', () => {
    test('thumbnail has alt text', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      const img = screen.getByAltText('Test Video Title');
      expect(img).toBeInTheDocument();
    });

    test('thumbnail has lazy loading', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      const img = screen.getByAltText('Test Video Title');
      expect(img).toHaveAttribute('loading', 'lazy');
    });

    test('thumbnail alt text decodes HTML entities', () => {
      const videoWithEncodedTitle = {
        ...mockVideo,
        title: 'Test &amp; Video &lt;Title&gt;',
      };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[videoWithEncodedTitle]} />);
      const img = screen.getByAltText('Test & Video <Title>');
      expect(img).toBeInTheDocument();
    });
  });

  describe('Status Icon Rendering', () => {
    test('renders CheckCircleIcon for downloaded videos', () => {
      const downloadedVideo = { ...mockVideo, added: true, removed: false };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[downloadedVideo]} />);
      expect(screen.getByTestId('CheckCircleIcon')).toBeInTheDocument();
    });

    test('renders CloudOffIcon for missing videos', () => {
      const missingVideo = { ...mockVideo, added: true, removed: true };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[missingVideo]} />);
      expect(screen.getByTestId('CloudOffIcon')).toBeInTheDocument();
    });

    test('renders LockIcon for members only videos', () => {
      const membersOnlyVideo = { ...mockVideo, availability: 'subscriber_only' };
      renderWithProviders(<VideoTableView {...defaultProps} videos={[membersOnlyVideo]} />);
      expect(screen.getByTestId('LockIcon')).toBeInTheDocument();
    });

    test('renders NewReleasesIcon for never downloaded videos', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      expect(screen.getByTestId('NewReleasesIcon')).toBeInTheDocument();
    });
  });

  describe('Table Structure', () => {
    test('renders table with correct structure', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    test('renders table head with correct number of columns', () => {
      renderWithProviders(<VideoTableView {...defaultProps} />);
      const headerCells = screen.getAllByRole('columnheader');
      // Checkbox, Thumbnail, Title, Published, Duration, Size, Status
      expect(headerCells).toHaveLength(7);
    });

    test('renders table rows for each video', () => {
      const videos = [
        mockVideo,
        { ...mockVideo, youtube_id: 'test456', title: 'Second Video' },
      ];
      renderWithProviders(<VideoTableView {...defaultProps} videos={videos} />);
      const rows = screen.getAllByRole('row');
      // Header row + 2 video rows
      expect(rows).toHaveLength(3);
    });
  });

  describe('Multiple Videos Selection', () => {
    test('handles selection of multiple videos', () => {
      const videos = [
        mockVideo,
        { ...mockVideo, youtube_id: 'test456', title: 'Second Video' },
        { ...mockVideo, youtube_id: 'test789', title: 'Third Video' },
      ];
      renderWithProviders(
        <VideoTableView
          {...defaultProps}
          videos={videos}
          checkedBoxes={['test123', 'test789']}
        />
      );
      const checkboxes = screen.getAllByRole('checkbox');
      // Header checkbox should be indeterminate
      expect(checkboxes[0]).toHaveAttribute('data-indeterminate', 'true');
      // First and third video checkboxes should be checked
      expect(checkboxes[1]).toBeChecked();
      expect(checkboxes[2]).not.toBeChecked();
      expect(checkboxes[3]).toBeChecked();
    });

    test('handles all videos selected', () => {
      const videos = [
        mockVideo,
        { ...mockVideo, youtube_id: 'test456', title: 'Second Video' },
      ];
      renderWithProviders(
        <VideoTableView
          {...defaultProps}
          videos={videos}
          checkedBoxes={['test123', 'test456']}
        />
      );
      const checkboxes = screen.getAllByRole('checkbox');
      // All checkboxes should be checked
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).toBeChecked();
      expect(checkboxes[2]).toBeChecked();
    });
  });
});
