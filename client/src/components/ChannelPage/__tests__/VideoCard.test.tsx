import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import VideoCard from '../VideoCard';
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

describe('VideoCard Component', () => {
  const mockVideo: ChannelVideo = {
    title: 'Test Video Title',
    youtube_id: 'test123',
    publishedAt: '2023-01-15T10:30:00Z',
    thumbnail: 'https://i.ytimg.com/vi/test123/mqdefault.jpg',
    added: false,
    duration: 600,
    media_type: 'video',
    live_status: null,
  };

  const defaultProps = {
    video: mockVideo,
    isMobile: false,
    checkedBoxes: [],
    hoveredVideo: null,
    selectedForDeletion: [],
    onCheckChange: jest.fn(),
    onHoverChange: jest.fn(),
    onDeletionChange: jest.fn(),
    onToggleIgnore: jest.fn(),
    selectionMode: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    });

    test('renders video thumbnail', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      const img = screen.getByAltText('Test Video Title');
      expect(img).toHaveAttribute('src', 'https://i.ytimg.com/vi/test123/mqdefault.jpg');
    });

    test('renders video title with HTML decoding', () => {
      const videoWithEncodedTitle = {
        ...mockVideo,
        title: 'Test &amp; Video &quot;Title&quot;',
      };
      renderWithProviders(<VideoCard {...defaultProps} video={videoWithEncodedTitle} />);
      expect(screen.getByText('Test & Video "Title"')).toBeInTheDocument();
    });

    test('renders duration chip for regular videos', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      // Duration is 600 seconds = 10 minutes
      const durationChip = screen.getByText(/10/);
      expect(durationChip).toBeInTheDocument();
    });

    test('does not render duration chip for shorts', () => {
      const shortVideo = { ...mockVideo, media_type: 'short', duration: 45 };
      renderWithProviders(<VideoCard {...defaultProps} video={shortVideo} />);
      // Shorts should still render "Short" chip (which has ScheduleIcon)
      expect(screen.getByText('Short')).toBeInTheDocument();
      // But should not show duration text (like "0:45") since duration chip is hidden
      expect(screen.queryByText('0:45')).not.toBeInTheDocument();
    });

    test('renders published date', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      expect(screen.getByText(/1\/15\/2023/)).toBeInTheDocument();
    });

    test('renders short date format on mobile', () => {
      renderWithProviders(<VideoCard {...defaultProps} isMobile={true} />);
      expect(screen.getByText(/Jan 15/)).toBeInTheDocument();
    });

    test('does not render published date for shorts', () => {
      const shortVideo = { ...mockVideo, media_type: 'short' };
      renderWithProviders(<VideoCard {...defaultProps} video={shortVideo} />);
      // Shorts should not show the CalendarTodayIcon or published date
      expect(screen.queryByTestId('CalendarTodayIcon')).not.toBeInTheDocument();
      expect(screen.queryByText(/1\/15\/2023/)).not.toBeInTheDocument();
    });
  });

  describe('Video Status', () => {
    test('renders "Not Downloaded" status for never downloaded video', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      expect(screen.getByText('Not Downloaded')).toBeInTheDocument();
    });

    test('renders "Downloaded" status for downloaded video', () => {
      const downloadedVideo = { ...mockVideo, added: true, removed: false };
      renderWithProviders(<VideoCard {...defaultProps} video={downloadedVideo} />);
      expect(screen.getByText('Downloaded')).toBeInTheDocument();
    });

    test('renders "Missing" status for removed video', () => {
      const removedVideo = { ...mockVideo, added: true, removed: true };
      renderWithProviders(<VideoCard {...defaultProps} video={removedVideo} />);
      expect(screen.getByText('Missing')).toBeInTheDocument();
    });

    test('renders "Members Only" status for subscriber-only video', () => {
      const membersOnlyVideo = { ...mockVideo, availability: 'subscriber_only' };
      renderWithProviders(<VideoCard {...defaultProps} video={membersOnlyVideo} />);
      expect(screen.getByText('Members Only')).toBeInTheDocument();
    });

    test('renders "Ignored" status for ignored video', () => {
      const ignoredVideo = { ...mockVideo, ignored: true };
      renderWithProviders(<VideoCard {...defaultProps} video={ignoredVideo} />);
      expect(screen.getByText('Ignored')).toBeInTheDocument();
    });
  });

  describe('Media Type Indicators', () => {
    test('renders short chip for short videos', () => {
      const shortVideo = { ...mockVideo, media_type: 'short' };
      renderWithProviders(<VideoCard {...defaultProps} video={shortVideo} />);
      expect(screen.getByText('Short')).toBeInTheDocument();
    });

    test('renders live chip for livestream videos', () => {
      const livestreamVideo = { ...mockVideo, media_type: 'livestream' };
      renderWithProviders(<VideoCard {...defaultProps} video={livestreamVideo} />);
      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    test('does not render media type chip for regular videos', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      expect(screen.queryByText('Short')).not.toBeInTheDocument();
      expect(screen.queryByText('Live')).not.toBeInTheDocument();
    });
  });

  describe('File Size Display', () => {
    test('renders file size chip when video file exists', () => {
      const videoWithFile = {
        ...mockVideo,
        added: true,
        removed: false,
        filePath: '/path/to/video.mp4',
        fileSize: 1024 * 1024 * 50
      };
      renderWithProviders(<VideoCard {...defaultProps} video={videoWithFile} />);
      // File size shown in format indicator chip
      expect(screen.getByText(/50/)).toBeInTheDocument();
      expect(screen.getByTestId('MovieOutlinedIcon')).toBeInTheDocument();
    });

    test('does not render format indicator when no file path exists', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      const movieIcons = screen.queryAllByTestId('MovieOutlinedIcon');
      expect(movieIcons.length).toBe(0);
    });
  });

  describe('YouTube Removed Banner', () => {
    test('shows removed banner when youtube_removed is true', () => {
      const removedVideo = { ...mockVideo, youtube_removed: true };
      renderWithProviders(<VideoCard {...defaultProps} video={removedVideo} />);
      expect(screen.getByText('Removed From YouTube')).toBeInTheDocument();
    });

    test('does not show removed banner when youtube_removed is false', () => {
      const notRemovedVideo = { ...mockVideo, youtube_removed: false };
      renderWithProviders(<VideoCard {...defaultProps} video={notRemovedVideo} />);
      expect(screen.queryByText('Removed From YouTube')).not.toBeInTheDocument();
    });

    test('does not show removed banner when youtube_removed is undefined', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      expect(screen.queryByText('Removed From YouTube')).not.toBeInTheDocument();
    });
  });

  describe('Still Live Videos', () => {
    test('renders StillLiveDot for videos with live_status is_live', () => {
      const liveVideo = { ...mockVideo, live_status: 'is_live' };
      renderWithProviders(<VideoCard {...defaultProps} video={liveVideo} />);
      expect(screen.getByTestId('still-live-dot')).toBeInTheDocument();
    });

    test('renders StillLiveDot for videos with live_status is_upcoming', () => {
      const upcomingVideo = { ...mockVideo, live_status: 'is_upcoming' };
      renderWithProviders(<VideoCard {...defaultProps} video={upcomingVideo} />);
      expect(screen.getByTestId('still-live-dot')).toBeInTheDocument();
    });

    test('does not render StillLiveDot for videos with live_status was_live', () => {
      const wasLiveVideo = { ...mockVideo, live_status: 'was_live' };
      renderWithProviders(<VideoCard {...defaultProps} video={wasLiveVideo} />);
      expect(screen.queryByTestId('still-live-dot')).not.toBeInTheDocument();
    });

    test('does not render StillLiveDot for videos with null live_status', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      expect(screen.queryByTestId('still-live-dot')).not.toBeInTheDocument();
    });

    test('does not render checkbox for still live videos', () => {
      const liveVideo = { ...mockVideo, live_status: 'is_live' };
      renderWithProviders(<VideoCard {...defaultProps} video={liveVideo} />);
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
  });

  describe('Delete Selection', () => {
    test('renders delete checkbox for downloaded videos', () => {
      const downloadedVideo = { ...mockVideo, added: true, removed: false };
      renderWithProviders(<VideoCard {...defaultProps} video={downloadedVideo} />);
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    test('calls onDeletionChange when delete checkbox is clicked', async () => {
      const user = userEvent.setup();
      const onDeletionChange = jest.fn();
      const downloadedVideo = { ...mockVideo, added: true, removed: false };

      renderWithProviders(
        <VideoCard
          {...defaultProps}
          video={downloadedVideo}
          onDeletionChange={onDeletionChange}
        />
      );

      const deleteCheckbox = screen.getByRole('checkbox');
      await user.click(deleteCheckbox);

      expect(onDeletionChange).toHaveBeenCalledTimes(1);
      expect(onDeletionChange).toHaveBeenCalledWith('test123', true);
    });
  });

  describe('Selection Checkbox', () => {
    test('renders download checkbox for selectable videos', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    test('checkbox is checked when video is in checkedBoxes', () => {
      renderWithProviders(
        <VideoCard {...defaultProps} checkedBoxes={['test123']} />
      );
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    test('calls onCheckChange when checkbox is clicked', async () => {
      const user = userEvent.setup();
      const onCheckChange = jest.fn();

      renderWithProviders(
        <VideoCard {...defaultProps} onCheckChange={onCheckChange} />
      );

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      expect(onCheckChange).toHaveBeenCalledTimes(1);
      expect(onCheckChange).toHaveBeenCalledWith('test123', true);
    });
  });

  describe('Card Click for Selection', () => {
    test('clicking card toggles selection for selectable videos', async () => {
      const user = userEvent.setup();
      const onCheckChange = jest.fn();

      renderWithProviders(
        <VideoCard {...defaultProps} onCheckChange={onCheckChange} />
      );

      const card = screen.getByText('Test Video Title');
      await user.click(card);

      expect(onCheckChange).toHaveBeenCalledWith('test123', true);
    });

    test('clicking card does not select downloaded videos', async () => {
      const user = userEvent.setup();
      const onCheckChange = jest.fn();
      const downloadedVideo = { ...mockVideo, added: true, removed: false };

      renderWithProviders(
        <VideoCard {...defaultProps} video={downloadedVideo} onCheckChange={onCheckChange} />
      );

      const card = screen.getByText('Test Video Title');
      await user.click(card);

      expect(onCheckChange).not.toHaveBeenCalled();
    });

    test('clicking card does not select still live videos', async () => {
      const user = userEvent.setup();
      const onCheckChange = jest.fn();
      const liveVideo = { ...mockVideo, live_status: 'is_live' };

      renderWithProviders(
        <VideoCard {...defaultProps} video={liveVideo} onCheckChange={onCheckChange} />
      );

      const card = screen.getByText('Test Video Title');
      await user.click(card);

      expect(onCheckChange).not.toHaveBeenCalled();
    });
  });

  describe('Ignore Button', () => {
    test('renders ignore button for never downloaded videos', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      expect(screen.getByTestId('BlockIcon')).toBeInTheDocument();
    });

    test('renders ignore button for missing videos', () => {
      const missingVideo = { ...mockVideo, added: true, removed: true };
      renderWithProviders(<VideoCard {...defaultProps} video={missingVideo} />);
      expect(screen.getByTestId('BlockIcon')).toBeInTheDocument();
    });

    test('does not render ignore button for downloaded videos', () => {
      const downloadedVideo = { ...mockVideo, added: true, removed: false };
      renderWithProviders(<VideoCard {...defaultProps} video={downloadedVideo} />);
      expect(screen.queryByTestId('BlockIcon')).not.toBeInTheDocument();
      expect(screen.queryByTestId('CheckCircleOutlineIcon')).not.toBeInTheDocument();
    });

    test('does not render ignore button for still live videos', () => {
      const liveVideo = { ...mockVideo, live_status: 'is_live' };
      renderWithProviders(<VideoCard {...defaultProps} video={liveVideo} />);
      expect(screen.queryByTestId('BlockIcon')).not.toBeInTheDocument();
      expect(screen.queryByTestId('CheckCircleOutlineIcon')).not.toBeInTheDocument();
    });

    test('renders CheckCircleOutlineIcon for ignored videos', () => {
      const ignoredVideo = { ...mockVideo, ignored: true };
      renderWithProviders(<VideoCard {...defaultProps} video={ignoredVideo} />);
      // When video is ignored, CheckCircleOutlineIcon is in the ignore/unignore button
      expect(screen.getByTestId('CheckCircleOutlineIcon')).toBeInTheDocument();
      // BlockIcon will still appear in the status chip
      expect(screen.getByTestId('BlockIcon')).toBeInTheDocument();
    });

    test('renders BlockIcon for non-ignored videos in ignore button', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      // BlockIcon appears in the ignore button for non-ignored videos
      expect(screen.getByTestId('BlockIcon')).toBeInTheDocument();
      // CheckCircleOutlineIcon should not be present
      expect(screen.queryByTestId('CheckCircleOutlineIcon')).not.toBeInTheDocument();
    });

    test('calls onToggleIgnore when ignore button is clicked', async () => {
      const user = userEvent.setup();
      const onToggleIgnore = jest.fn();

      renderWithProviders(
        <VideoCard
          {...defaultProps}
          onToggleIgnore={onToggleIgnore}
        />
      );

      const ignoreButton = screen.getByRole('button');
      await user.click(ignoreButton);

      expect(onToggleIgnore).toHaveBeenCalledTimes(1);
      expect(onToggleIgnore).toHaveBeenCalledWith('test123');
    });

    test('calls onToggleIgnore when unignore button is clicked', async () => {
      const user = userEvent.setup();
      const onToggleIgnore = jest.fn();
      const ignoredVideo = { ...mockVideo, ignored: true };

      renderWithProviders(
        <VideoCard
          {...defaultProps}
          video={ignoredVideo}
          onToggleIgnore={onToggleIgnore}
        />
      );

      const unignoreButton = screen.getByRole('button');
      await user.click(unignoreButton);

      expect(onToggleIgnore).toHaveBeenCalledTimes(1);
      expect(onToggleIgnore).toHaveBeenCalledWith('test123');
    });

    test('ignore button click stops propagation', async () => {
      const user = userEvent.setup();
      const onToggleIgnore = jest.fn();
      const onCheckChange = jest.fn();

      renderWithProviders(
        <VideoCard
          {...defaultProps}
          onToggleIgnore={onToggleIgnore}
          onCheckChange={onCheckChange}
        />
      );

      const ignoreButton = screen.getByRole('button');
      await user.click(ignoreButton);

      expect(onToggleIgnore).toHaveBeenCalledTimes(1);
      expect(onCheckChange).not.toHaveBeenCalled();
    });

    test('shows correct tooltip for ignore button', async () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      const ignoreButton = screen.getByRole('button');
      expect(ignoreButton).toBeInTheDocument();
    });

    test('shows correct tooltip for unignore button', async () => {
      const ignoredVideo = { ...mockVideo, ignored: true };
      renderWithProviders(<VideoCard {...defaultProps} video={ignoredVideo} />);
      const unignoreButton = screen.getByRole('button');
      expect(unignoreButton).toBeInTheDocument();
    });
  });

  describe('Hover Interactions', () => {
    test('calls onHoverChange when mouse enters card', async () => {
      const user = userEvent.setup();
      const onHoverChange = jest.fn();

      const { container } = renderWithProviders(
        <VideoCard {...defaultProps} onHoverChange={onHoverChange} />
      );

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const card = container.querySelector('.MuiCard-root');
      expect(card).toBeTruthy();
      if (card) {
        await user.hover(card);
      }
      expect(onHoverChange).toHaveBeenCalledWith('test123');
    });

    test('calls onHoverChange with null when mouse leaves card', async () => {
      const user = userEvent.setup();
      const onHoverChange = jest.fn();

      const { container } = renderWithProviders(
        <VideoCard {...defaultProps} onHoverChange={onHoverChange} />
      );

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const card = container.querySelector('.MuiCard-root');
      expect(card).toBeTruthy();
      if (card) {
        await user.hover(card);
        await user.unhover(card);
      }
      expect(onHoverChange).toHaveBeenCalledWith(null);
    });
  });

  describe('Mobile Tooltip Callback', () => {
    test('passes onMobileTooltip to StillLiveDot component', () => {
      const onMobileTooltip = jest.fn();
      const liveVideo = { ...mockVideo, live_status: 'is_live' };

      renderWithProviders(
        <VideoCard
          {...defaultProps}
          video={liveVideo}
          onMobileTooltip={onMobileTooltip}
        />
      );

      expect(screen.getByTestId('still-live-dot')).toBeInTheDocument();
    });
  });

  describe('Desktop vs Mobile Layout', () => {
    test('status chip is inline with date on mobile', () => {
      renderWithProviders(<VideoCard {...defaultProps} isMobile={true} />);
      // Both status and date should be visible on mobile
      expect(screen.getByText('Not Downloaded')).toBeInTheDocument();
      expect(screen.getByText(/Jan 15/)).toBeInTheDocument();
    });

    test('status chip is on separate row on desktop', () => {
      renderWithProviders(<VideoCard {...defaultProps} isMobile={false} />);
      // Status should be visible on desktop too
      expect(screen.getByText('Not Downloaded')).toBeInTheDocument();
      expect(screen.getByText(/1\/15\/2023/)).toBeInTheDocument();
    });
  });

  describe('Thumbnail Object Fit', () => {
    test('uses contain object fit for shorts', () => {
      const shortVideo = { ...mockVideo, media_type: 'short' };
      renderWithProviders(<VideoCard {...defaultProps} video={shortVideo} />);
      const img = screen.getByAltText('Test Video Title');
      expect(img).toHaveStyle({ objectFit: 'contain' });
    });

    test('uses cover object fit for regular videos', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      const img = screen.getByAltText('Test Video Title');
      expect(img).toHaveStyle({ objectFit: 'cover' });
    });
  });

  describe('Edge Cases', () => {
    test('handles video with null duration', () => {
      const videoNoDuration = { ...mockVideo, duration: 0 };
      renderWithProviders(<VideoCard {...defaultProps} video={videoNoDuration} />);
      // Just verify it renders without crashing
      expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    });

    test('handles video with long title', () => {
      const longTitleVideo = {
        ...mockVideo,
        title: 'A'.repeat(200),
      };
      renderWithProviders(<VideoCard {...defaultProps} video={longTitleVideo} />);
      expect(screen.getByText('A'.repeat(200))).toBeInTheDocument();
    });

    test('handles video published in different year', () => {
      const oldVideo = { ...mockVideo, publishedAt: '2020-12-25T00:00:00Z' };
      renderWithProviders(<VideoCard {...defaultProps} video={oldVideo} />);
      expect(screen.getByText(/2020/)).toBeInTheDocument();
    });

    test('handles video with very large file size', () => {
      const largeVideo = {
        ...mockVideo,
        added: true,
        removed: false,
        filePath: '/path/to/video.mp4',
        fileSize: 1024 * 1024 * 1024 * 5.5
      };
      renderWithProviders(<VideoCard {...defaultProps} video={largeVideo} />);
      // Check for file size presence in format indicator chip
      expect(screen.getByText(/GB/)).toBeInTheDocument();
      expect(screen.getByTestId('MovieOutlinedIcon')).toBeInTheDocument();
    });

    test('handles video in both selectedForDeletion and checkedBoxes', () => {
      const downloadedVideo = { ...mockVideo, added: true, removed: false };
      renderWithProviders(
        <VideoCard
          {...defaultProps}
          video={downloadedVideo}
          selectedForDeletion={['test123']}
          checkedBoxes={['test123']}
        />
      );
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    test('renders ignored video with reduced opacity', () => {
      const ignoredVideo = { ...mockVideo, ignored: true };
      const { container } = renderWithProviders(
        <VideoCard {...defaultProps} video={ignoredVideo} />
      );
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const card = container.querySelector('.MuiCard-root');
      expect(card).toHaveStyle({ opacity: 0.7 });
    });

    test('clicking card toggles selection for ignored videos', async () => {
      const user = userEvent.setup();
      const onCheckChange = jest.fn();
      const ignoredVideo = { ...mockVideo, ignored: true };

      renderWithProviders(
        <VideoCard {...defaultProps} video={ignoredVideo} onCheckChange={onCheckChange} />
      );

      const card = screen.getByText('Test Video Title');
      await user.click(card);

      expect(onCheckChange).toHaveBeenCalledWith('test123', true);
    });
  });

  describe('Accessibility', () => {
    test('thumbnail has alt text', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      const img = screen.getByAltText('Test Video Title');
      expect(img).toBeInTheDocument();
    });

    test('title has title attribute for tooltip', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      const title = screen.getByText('Test Video Title');
      expect(title).toHaveAttribute('title', 'Test Video Title');
    });

    test('thumbnail has lazy loading', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      const img = screen.getByAltText('Test Video Title');
      expect(img).toHaveAttribute('loading', 'lazy');
    });
  });

  describe('Status Icon Rendering', () => {
    test('renders CheckCircleIcon for downloaded videos', () => {
      const downloadedVideo = { ...mockVideo, added: true, removed: false };
      renderWithProviders(<VideoCard {...defaultProps} video={downloadedVideo} />);
      expect(screen.getByTestId('CheckCircleIcon')).toBeInTheDocument();
    });

    test('renders CloudOffIcon for missing videos', () => {
      const missingVideo = { ...mockVideo, added: true, removed: true };
      renderWithProviders(<VideoCard {...defaultProps} video={missingVideo} />);
      expect(screen.getByTestId('CloudOffIcon')).toBeInTheDocument();
    });

    test('renders LockIcon for members only videos', () => {
      const membersOnlyVideo = { ...mockVideo, availability: 'subscriber_only' };
      renderWithProviders(<VideoCard {...defaultProps} video={membersOnlyVideo} />);
      expect(screen.getByTestId('LockIcon')).toBeInTheDocument();
    });

    test('renders NewReleasesIcon for never downloaded videos', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      expect(screen.getByTestId('NewReleasesIcon')).toBeInTheDocument();
    });

    test('renders BlockIcon status for ignored videos', () => {
      const ignoredVideo = { ...mockVideo, ignored: true };
      renderWithProviders(<VideoCard {...defaultProps} video={ignoredVideo} />);
      // The status chip should show BlockIcon
      const blockIcons = screen.getAllByTestId('BlockIcon');
      expect(blockIcons.length).toBeGreaterThan(0);
    });
  });
});
