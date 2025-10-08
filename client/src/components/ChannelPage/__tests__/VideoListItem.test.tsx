import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import VideoListItem from '../VideoListItem';
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

describe('VideoListItem Component', () => {
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
    checkedBoxes: [],
    selectedForDeletion: [],
    onCheckChange: jest.fn(),
    onToggleDeletion: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      renderWithProviders(<VideoListItem {...defaultProps} />);
      expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    });

    test('renders video thumbnail', () => {
      renderWithProviders(<VideoListItem {...defaultProps} />);
      const img = screen.getByAltText('Test Video Title');
      expect(img).toHaveAttribute('src', 'https://i.ytimg.com/vi/test123/mqdefault.jpg');
    });

    test('renders video title with HTML decoding', () => {
      const videoWithEncodedTitle = {
        ...mockVideo,
        title: 'Test &amp; Video &quot;Title&quot;',
      };
      renderWithProviders(<VideoListItem {...defaultProps} video={videoWithEncodedTitle} />);
      expect(screen.getByText('Test & Video "Title"')).toBeInTheDocument();
    });

    test('renders duration chip for regular videos', () => {
      renderWithProviders(<VideoListItem {...defaultProps} />);
      // Duration is 600 seconds = 10 minutes
      expect(screen.getByText('10m')).toBeInTheDocument();
    });

    test('does not render duration chip for shorts', () => {
      const shortVideo = { ...mockVideo, media_type: 'short' };
      renderWithProviders(<VideoListItem {...defaultProps} video={shortVideo} />);
      // Verify duration doesn't appear
      expect(screen.queryByText('10m')).not.toBeInTheDocument();
    });

    test('renders published date', () => {
      renderWithProviders(<VideoListItem {...defaultProps} />);
      expect(screen.getByText(/Jan 15, 23/)).toBeInTheDocument();
    });
  });

  describe('Video Status', () => {
    test('renders "Not Downloaded" status for never downloaded video', () => {
      renderWithProviders(<VideoListItem {...defaultProps} />);
      expect(screen.getByText('Not Downloaded')).toBeInTheDocument();
    });

    test('renders "Downloaded" status for downloaded video', () => {
      const downloadedVideo = { ...mockVideo, added: true, removed: false };
      renderWithProviders(<VideoListItem {...defaultProps} video={downloadedVideo} />);
      expect(screen.getByText('Downloaded')).toBeInTheDocument();
    });

    test('renders "Missing" status for removed video', () => {
      const removedVideo = { ...mockVideo, added: true, removed: true };
      renderWithProviders(<VideoListItem {...defaultProps} video={removedVideo} />);
      expect(screen.getByText('Missing')).toBeInTheDocument();
    });

    test('renders "Members Only" status for subscriber-only video', () => {
      const membersOnlyVideo = { ...mockVideo, availability: 'subscriber_only' };
      renderWithProviders(<VideoListItem {...defaultProps} video={membersOnlyVideo} />);
      expect(screen.getByText('Members Only')).toBeInTheDocument();
    });
  });

  describe('Media Type Indicators', () => {
    test('renders short chip for short videos', () => {
      const shortVideo = { ...mockVideo, media_type: 'short' };
      renderWithProviders(<VideoListItem {...defaultProps} video={shortVideo} />);
      expect(screen.getByText('Short')).toBeInTheDocument();
    });

    test('renders live chip for livestream videos', () => {
      const livestreamVideo = { ...mockVideo, media_type: 'livestream' };
      renderWithProviders(<VideoListItem {...defaultProps} video={livestreamVideo} />);
      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    test('does not render media type chip for regular videos', () => {
      renderWithProviders(<VideoListItem {...defaultProps} />);
      expect(screen.queryByText('Short')).not.toBeInTheDocument();
      expect(screen.queryByText('Live')).not.toBeInTheDocument();
    });
  });

  describe('File Size Display', () => {
    test('renders file size when available', () => {
      const videoWithSize = { ...mockVideo, fileSize: 1024 * 1024 * 50 };
      renderWithProviders(<VideoListItem {...defaultProps} video={videoWithSize} />);
      expect(screen.getByText('50MB')).toBeInTheDocument();
      expect(screen.getByTestId('StorageIcon')).toBeInTheDocument();
    });

    test('does not render file size when not available', () => {
      renderWithProviders(<VideoListItem {...defaultProps} />);
      const storageIcons = screen.queryAllByTestId('StorageIcon');
      expect(storageIcons.length).toBe(0);
    });
  });

  describe('YouTube Removed Banner', () => {
    test('shows removed banner when youtube_removed is true', () => {
      const removedVideo = { ...mockVideo, youtube_removed: true };
      renderWithProviders(<VideoListItem {...defaultProps} video={removedVideo} />);
      expect(screen.getByText('Removed From YouTube')).toBeInTheDocument();
    });

    test('does not show removed banner when youtube_removed is false', () => {
      const notRemovedVideo = { ...mockVideo, youtube_removed: false };
      renderWithProviders(<VideoListItem {...defaultProps} video={notRemovedVideo} />);
      expect(screen.queryByText('Removed From YouTube')).not.toBeInTheDocument();
    });

    test('does not show removed banner when youtube_removed is undefined', () => {
      renderWithProviders(<VideoListItem {...defaultProps} />);
      expect(screen.queryByText('Removed From YouTube')).not.toBeInTheDocument();
    });
  });

  describe('Still Live Videos', () => {
    test('renders StillLiveDot for videos with live_status is_live', () => {
      const liveVideo = { ...mockVideo, live_status: 'is_live' };
      renderWithProviders(<VideoListItem {...defaultProps} video={liveVideo} />);
      expect(screen.getByTestId('still-live-dot')).toBeInTheDocument();
    });

    test('renders StillLiveDot for videos with live_status is_upcoming', () => {
      const upcomingVideo = { ...mockVideo, live_status: 'is_upcoming' };
      renderWithProviders(<VideoListItem {...defaultProps} video={upcomingVideo} />);
      expect(screen.getByTestId('still-live-dot')).toBeInTheDocument();
    });

    test('does not render StillLiveDot for videos with live_status was_live', () => {
      const wasLiveVideo = { ...mockVideo, live_status: 'was_live' };
      renderWithProviders(<VideoListItem {...defaultProps} video={wasLiveVideo} />);
      expect(screen.queryByTestId('still-live-dot')).not.toBeInTheDocument();
    });

    test('does not render StillLiveDot for videos with null live_status', () => {
      renderWithProviders(<VideoListItem {...defaultProps} />);
      expect(screen.queryByTestId('still-live-dot')).not.toBeInTheDocument();
    });

    test('does not render checkbox for still live videos', () => {
      const liveVideo = { ...mockVideo, live_status: 'is_live' };
      renderWithProviders(<VideoListItem {...defaultProps} video={liveVideo} />);
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    test('passes onMobileTooltip to StillLiveDot component', () => {
      const onMobileTooltip = jest.fn();
      const liveVideo = { ...mockVideo, live_status: 'is_live' };

      renderWithProviders(
        <VideoListItem
          {...defaultProps}
          video={liveVideo}
          onMobileTooltip={onMobileTooltip}
        />
      );

      expect(screen.getByTestId('still-live-dot')).toBeInTheDocument();
    });
  });

  describe('Video Selection (Checkbox)', () => {
    test('renders checkbox for never downloaded videos', () => {
      renderWithProviders(<VideoListItem {...defaultProps} />);
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    test('renders checkbox for missing videos', () => {
      const missingVideo = { ...mockVideo, added: true, removed: true };
      renderWithProviders(<VideoListItem {...defaultProps} video={missingVideo} />);
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    test('does not render checkbox for downloaded videos', () => {
      const downloadedVideo = { ...mockVideo, added: true, removed: false };
      renderWithProviders(<VideoListItem {...defaultProps} video={downloadedVideo} />);
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    test('does not render checkbox for members only videos', () => {
      const membersOnlyVideo = { ...mockVideo, availability: 'subscriber_only' };
      renderWithProviders(<VideoListItem {...defaultProps} video={membersOnlyVideo} />);
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    test('checkbox is checked when video is in checkedBoxes', () => {
      renderWithProviders(
        <VideoListItem {...defaultProps} checkedBoxes={['test123']} />
      );
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    test('checkbox is unchecked when video is not in checkedBoxes', () => {
      renderWithProviders(<VideoListItem {...defaultProps} />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });

    test('calls onCheckChange when checkbox is clicked', async () => {
      const user = userEvent.setup();
      const onCheckChange = jest.fn();

      renderWithProviders(
        <VideoListItem {...defaultProps} onCheckChange={onCheckChange} />
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
        <VideoListItem
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
        <VideoListItem {...defaultProps} onCheckChange={onCheckChange} />
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
        <VideoListItem {...defaultProps} onCheckChange={onCheckChange} />
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
        <VideoListItem {...defaultProps} video={downloadedVideo} onCheckChange={onCheckChange} />
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
        <VideoListItem {...defaultProps} video={liveVideo} onCheckChange={onCheckChange} />
      );

      const card = screen.getByText('Test Video Title');
      await user.click(card);

      expect(onCheckChange).not.toHaveBeenCalled();
    });

    test('clicking card does not select members only videos', async () => {
      const user = userEvent.setup();
      const onCheckChange = jest.fn();
      const membersOnlyVideo = { ...mockVideo, availability: 'subscriber_only' };

      renderWithProviders(
        <VideoListItem {...defaultProps} video={membersOnlyVideo} onCheckChange={onCheckChange} />
      );

      const card = screen.getByText('Test Video Title');
      await user.click(card);

      expect(onCheckChange).not.toHaveBeenCalled();
    });

    test('clicking card toggles from checked to unchecked', async () => {
      const user = userEvent.setup();
      const onCheckChange = jest.fn();

      renderWithProviders(
        <VideoListItem
          {...defaultProps}
          checkedBoxes={['test123']}
          onCheckChange={onCheckChange}
        />
      );

      const card = screen.getByText('Test Video Title');
      await user.click(card);

      expect(onCheckChange).toHaveBeenCalledWith('test123', false);
    });
  });

  describe('Delete Button', () => {
    test('renders delete button for downloaded videos', () => {
      const downloadedVideo = { ...mockVideo, added: true, removed: false };
      renderWithProviders(<VideoListItem {...defaultProps} video={downloadedVideo} />);
      expect(screen.getByTestId('DeleteIcon')).toBeInTheDocument();
    });

    test('does not render delete button for never downloaded videos', () => {
      renderWithProviders(<VideoListItem {...defaultProps} />);
      expect(screen.queryByTestId('DeleteIcon')).not.toBeInTheDocument();
    });

    test('does not render delete button for missing videos', () => {
      const missingVideo = { ...mockVideo, added: true, removed: true };
      renderWithProviders(<VideoListItem {...defaultProps} video={missingVideo} />);
      expect(screen.queryByTestId('DeleteIcon')).not.toBeInTheDocument();
    });

    test('calls onToggleDeletion when delete button is clicked', async () => {
      const user = userEvent.setup();
      const onToggleDeletion = jest.fn();
      const downloadedVideo = { ...mockVideo, added: true, removed: false };

      renderWithProviders(
        <VideoListItem
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
        <VideoListItem
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

  describe('Thumbnail Object Fit', () => {
    test('uses contain object fit for shorts', () => {
      const shortVideo = { ...mockVideo, media_type: 'short' };
      renderWithProviders(<VideoListItem {...defaultProps} video={shortVideo} />);
      const img = screen.getByAltText('Test Video Title');
      expect(img).toHaveStyle({ objectFit: 'contain' });
    });

    test('uses cover object fit for regular videos', () => {
      renderWithProviders(<VideoListItem {...defaultProps} />);
      const img = screen.getByAltText('Test Video Title');
      expect(img).toHaveStyle({ objectFit: 'cover' });
    });
  });

  describe('Edge Cases', () => {
    test('handles video with null duration', () => {
      const videoNoDuration = { ...mockVideo, duration: 0 };
      renderWithProviders(<VideoListItem {...defaultProps} video={videoNoDuration} />);
      expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    });

    test('handles video with long title', () => {
      const longTitleVideo = {
        ...mockVideo,
        title: 'A'.repeat(200),
      };
      renderWithProviders(<VideoListItem {...defaultProps} video={longTitleVideo} />);
      expect(screen.getByText('A'.repeat(200))).toBeInTheDocument();
    });

    test('handles video published in different year', () => {
      const oldVideo = { ...mockVideo, publishedAt: '2020-12-25T12:00:00Z' };
      renderWithProviders(<VideoListItem {...defaultProps} video={oldVideo} />);
      // Check for date and year (exact date may vary by timezone)
      expect(screen.getByText(/Dec/)).toBeInTheDocument();
      expect(screen.getByText(/20/)).toBeInTheDocument();
    });

    test('handles video with very large file size', () => {
      const largeVideo = { ...mockVideo, fileSize: 1024 * 1024 * 1024 * 5.5 };
      renderWithProviders(<VideoListItem {...defaultProps} video={largeVideo} />);
      expect(screen.getByText('5.5GB')).toBeInTheDocument();
      expect(screen.getByTestId('StorageIcon')).toBeInTheDocument();
    });

    test('handles video in both selectedForDeletion and checkedBoxes', () => {
      const downloadedVideo = { ...mockVideo, added: true, removed: false };
      renderWithProviders(
        <VideoListItem
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
      renderWithProviders(<VideoListItem {...defaultProps} />);
      const img = screen.getByAltText('Test Video Title');
      expect(img).toBeInTheDocument();
    });

    test('title has title attribute for tooltip', () => {
      renderWithProviders(<VideoListItem {...defaultProps} />);
      const title = screen.getByText('Test Video Title');
      expect(title).toHaveAttribute('title', 'Test Video Title');
    });

    test('thumbnail has lazy loading', () => {
      renderWithProviders(<VideoListItem {...defaultProps} />);
      const img = screen.getByAltText('Test Video Title');
      expect(img).toHaveAttribute('loading', 'lazy');
    });

    test('thumbnail alt text decodes HTML entities', () => {
      const videoWithEncodedTitle = {
        ...mockVideo,
        title: 'Test &amp; Video &lt;Title&gt;',
      };
      renderWithProviders(<VideoListItem {...defaultProps} video={videoWithEncodedTitle} />);
      const img = screen.getByAltText('Test & Video <Title>');
      expect(img).toBeInTheDocument();
    });
  });

  describe('Status Icon Rendering', () => {
    test('renders CheckCircleIcon for downloaded videos', () => {
      const downloadedVideo = { ...mockVideo, added: true, removed: false };
      renderWithProviders(<VideoListItem {...defaultProps} video={downloadedVideo} />);
      expect(screen.getByTestId('CheckCircleIcon')).toBeInTheDocument();
    });

    test('renders CloudOffIcon for missing videos', () => {
      const missingVideo = { ...mockVideo, added: true, removed: true };
      renderWithProviders(<VideoListItem {...defaultProps} video={missingVideo} />);
      expect(screen.getByTestId('CloudOffIcon')).toBeInTheDocument();
    });

    test('renders LockIcon for members only videos', () => {
      const membersOnlyVideo = { ...mockVideo, availability: 'subscriber_only' };
      renderWithProviders(<VideoListItem {...defaultProps} video={membersOnlyVideo} />);
      expect(screen.getByTestId('LockIcon')).toBeInTheDocument();
    });

    test('renders NewReleasesIcon for never downloaded videos', () => {
      renderWithProviders(<VideoListItem {...defaultProps} />);
      expect(screen.getByTestId('NewReleasesIcon')).toBeInTheDocument();
    });
  });

  describe('Fade Animation', () => {
    test('renders with fade animation wrapper', () => {
      renderWithProviders(<VideoListItem {...defaultProps} />);
      expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    });
  });
});
