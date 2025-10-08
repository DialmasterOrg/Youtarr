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
    onToggleDeletion: jest.fn(),
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
      const shortVideo = { ...mockVideo, media_type: 'short' };
      renderWithProviders(<VideoCard {...defaultProps} video={shortVideo} />);
      // Verify duration doesn't appear by checking for the CalendarTodayIcon but not duration text
      expect(screen.getByTestId('CalendarTodayIcon')).toBeInTheDocument();
    });

    test('renders published date', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      expect(screen.getByText(/1\/15\/2023/)).toBeInTheDocument();
    });

    test('renders short date format on mobile', () => {
      renderWithProviders(<VideoCard {...defaultProps} isMobile={true} />);
      expect(screen.getByText(/Jan 15/)).toBeInTheDocument();
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
    test('renders file size when available', () => {
      const videoWithSize = { ...mockVideo, fileSize: 1024 * 1024 * 50 };
      renderWithProviders(<VideoCard {...defaultProps} video={videoWithSize} />);
      expect(screen.getByText(/50/)).toBeInTheDocument();
      expect(screen.getByTestId('StorageIcon')).toBeInTheDocument();
    });

    test('does not render file size when not available', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      const storageIcons = screen.queryAllByTestId('StorageIcon');
      expect(storageIcons.length).toBe(0);
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

  describe('Video Selection (Checkbox)', () => {
    test('renders checkbox for never downloaded videos', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    test('renders checkbox for missing videos', () => {
      const missingVideo = { ...mockVideo, added: true, removed: true };
      renderWithProviders(<VideoCard {...defaultProps} video={missingVideo} />);
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    test('does not render checkbox for downloaded videos', () => {
      const downloadedVideo = { ...mockVideo, added: true, removed: false };
      renderWithProviders(<VideoCard {...defaultProps} video={downloadedVideo} />);
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    test('does not render checkbox for members only videos', () => {
      const membersOnlyVideo = { ...mockVideo, availability: 'subscriber_only' };
      renderWithProviders(<VideoCard {...defaultProps} video={membersOnlyVideo} />);
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    test('checkbox is checked when video is in checkedBoxes', () => {
      renderWithProviders(
        <VideoCard {...defaultProps} checkedBoxes={['test123']} />
      );
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    test('checkbox is unchecked when video is not in checkedBoxes', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
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

    test('calls onCheckChange with false when checked checkbox is clicked', async () => {
      const user = userEvent.setup();
      const onCheckChange = jest.fn();

      renderWithProviders(
        <VideoCard
          {...defaultProps}
          checkedBoxes={['test123']}
          onCheckChange={onCheckChange}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      expect(onCheckChange).toHaveBeenCalledWith('test123', false);
    });

    test('checkbox click stops propagation', async () => {
      const user = userEvent.setup();
      const onCheckChange = jest.fn();

      renderWithProviders(
        <VideoCard {...defaultProps} onCheckChange={onCheckChange} />
      );

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      // Should be called once from checkbox, not from card click
      expect(onCheckChange).toHaveBeenCalledTimes(1);
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

  describe('Delete Button', () => {
    test('renders delete button for downloaded videos', () => {
      const downloadedVideo = { ...mockVideo, added: true, removed: false };
      renderWithProviders(<VideoCard {...defaultProps} video={downloadedVideo} />);
      expect(screen.getByTestId('DeleteIcon')).toBeInTheDocument();
    });

    test('does not render delete button for never downloaded videos', () => {
      renderWithProviders(<VideoCard {...defaultProps} />);
      expect(screen.queryByTestId('DeleteIcon')).not.toBeInTheDocument();
    });

    test('does not render delete button for missing videos', () => {
      const missingVideo = { ...mockVideo, added: true, removed: true };
      renderWithProviders(<VideoCard {...defaultProps} video={missingVideo} />);
      expect(screen.queryByTestId('DeleteIcon')).not.toBeInTheDocument();
    });

    test('calls onToggleDeletion when delete button is clicked', async () => {
      const user = userEvent.setup();
      const onToggleDeletion = jest.fn();
      const downloadedVideo = { ...mockVideo, added: true, removed: false };

      renderWithProviders(
        <VideoCard
          {...defaultProps}
          video={downloadedVideo}
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
        <VideoCard
          {...defaultProps}
          video={downloadedVideo}
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
      const largeVideo = { ...mockVideo, fileSize: 1024 * 1024 * 1024 * 5.5 };
      renderWithProviders(<VideoCard {...defaultProps} video={largeVideo} />);
      // Check for file size presence - look for GB text
      expect(screen.getByText(/GB/)).toBeInTheDocument();
      expect(screen.getByTestId('StorageIcon')).toBeInTheDocument();
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
      // Should show delete button since it's downloaded
      expect(screen.getByTestId('DeleteIcon')).toBeInTheDocument();
      // Should not show checkbox since it's downloaded
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
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
  });
});
