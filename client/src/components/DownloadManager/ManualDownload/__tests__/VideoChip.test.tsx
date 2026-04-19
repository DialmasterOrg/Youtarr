import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoChip from '../VideoChip';
import { VideoInfo } from '../types';

describe('VideoChip', () => {
  const mockOnDelete = jest.fn();

  const baseVideo: VideoInfo = {
    youtubeId: 'test123',
    url: 'https://youtube.com/watch?v=test123',
    channelName: 'Test Channel',
    videoTitle: 'Test Video Title',
    duration: 125,
    publishedAt: Date.now(),
    isAlreadyDownloaded: false,
    isMembersOnly: false,
    media_type: 'video',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders basic video chip with channel name and title', () => {
      render(<VideoChip video={baseVideo} onDelete={mockOnDelete} />);

      expect(screen.getByText('Test Channel')).toBeInTheDocument();
      expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    });

    test('renders duration in correct format for seconds only', () => {
      const video = { ...baseVideo, duration: 45 };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      expect(screen.getByText('0:45')).toBeInTheDocument();
    });

    test('renders duration in correct format for minutes and seconds', () => {
      const video = { ...baseVideo, duration: 125 };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      expect(screen.getByText('2:05')).toBeInTheDocument();
    });

    test('renders duration in correct format for hours', () => {
      const video = { ...baseVideo, duration: 3665 };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      expect(screen.getByText('1:01:05')).toBeInTheDocument();
    });

    test('renders duration with proper padding', () => {
      const video = { ...baseVideo, duration: 3601 };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      expect(screen.getByText('1:00:01')).toBeInTheDocument();
    });

    test('renders full channel name in a CSS-truncated container', () => {
      const longChannelName = 'This is a very long channel name that should be truncated';
      const video = { ...baseVideo, channelName: longChannelName };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      const element = screen.getByText(longChannelName);
      expect(element).toBeInTheDocument();
      expect(element).toHaveClass('truncate');
    });

    test('renders full video title in a CSS-truncated container', () => {
      const longTitle = 'This is a very long video title that should definitely be truncated after a certain number of characters';
      const video = { ...baseVideo, videoTitle: longTitle };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      const element = screen.getByText(longTitle);
      expect(element).toBeInTheDocument();
      expect(element).toHaveClass('truncate');
    });

    test('does not truncate short text', () => {
      const video = {
        ...baseVideo,
        channelName: 'Short Name',
        videoTitle: 'Short Title',
      };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      expect(screen.getByText('Short Name')).toBeInTheDocument();
      expect(screen.getByText('Short Title')).toBeInTheDocument();
    });
  });

  describe('Status Icons and Colors', () => {
    test('shows history icon for already downloaded videos', () => {
      const video = { ...baseVideo, isAlreadyDownloaded: true };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      expect(screen.getByTestId('HistoryIcon')).toBeInTheDocument();
    });

    test('shows lock icon for members-only videos', () => {
      const video = { ...baseVideo, isMembersOnly: true };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      expect(screen.getByTestId('LockIcon')).toBeInTheDocument();
    });

    test('shows no status icon for regular videos', () => {
      render(<VideoChip video={baseVideo} onDelete={mockOnDelete} />);

      expect(screen.queryByTestId('HistoryIcon')).not.toBeInTheDocument();
      expect(screen.queryByTestId('LockIcon')).not.toBeInTheDocument();
    });

    test('applies warning color for downloaded videos', () => {
      const video = { ...baseVideo, isAlreadyDownloaded: true };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      const chip = screen.getByRole('button', { name: /Test Video Title/i });
      expect(chip).toHaveClass('chip-warning');
    });

    test('applies error color for members-only videos', () => {
      const video = { ...baseVideo, isMembersOnly: true };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      const chip = screen.getByRole('button', { name: /Test Video Title/i });
      expect(chip).toHaveClass('chip-error');
    });

    test('applies default color for regular videos', () => {
      render(<VideoChip video={baseVideo} onDelete={mockOnDelete} />);

      const chip = screen.getByRole('button', { name: /Test Video Title/i });
      expect(chip).toHaveClass('chip-default');
    });

    test('applies filled variant for downloaded videos', () => {
      const video = { ...baseVideo, isAlreadyDownloaded: true };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      const chip = screen.getByRole('button', { name: /Test Video Title/i });
      expect(chip).toHaveClass('chip-filled');
    });

    test('applies filled variant for members-only videos', () => {
      const video = { ...baseVideo, isMembersOnly: true };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      const chip = screen.getByRole('button', { name: /Test Video Title/i });
      expect(chip).toHaveClass('chip-filled');
    });

    test('applies filled variant for regular videos', () => {
      render(<VideoChip video={baseVideo} onDelete={mockOnDelete} />);

      const chip = screen.getByRole('button', { name: /Test Video Title/i });
      expect(chip).toHaveClass('chip-filled');
    });
  });

  describe('Media type indicator', () => {
    test('does not render indicator for standard videos', () => {
      render(<VideoChip video={baseVideo} onDelete={mockOnDelete} />);

      expect(screen.queryByText('Short')).not.toBeInTheDocument();
      expect(screen.queryByText('Live')).not.toBeInTheDocument();
    });

    test('renders label for shorts', () => {
      const video = { ...baseVideo, media_type: 'short' };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      expect(screen.getByText('Short')).toBeInTheDocument();
    });

    test('renders formatted label for livestreams', () => {
      const video = { ...baseVideo, media_type: 'livestream' };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    test('formats custom media types', () => {
      const video = { ...baseVideo, media_type: 'audio_only' };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      expect(screen.getByText('Audio Only')).toBeInTheDocument();
    });
  });

  describe('Accessible name', () => {
    test('exposes video title as the chip accessible name', () => {
      render(<VideoChip video={baseVideo} onDelete={mockOnDelete} />);

      expect(screen.getByRole('button', { name: 'Test Video Title' })).toBeInTheDocument();
    });

    test('annotates accessible name for already downloaded videos', () => {
      const video = { ...baseVideo, isAlreadyDownloaded: true };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      expect(
        screen.getByRole('button', { name: 'Test Video Title - Already downloaded' })
      ).toBeInTheDocument();
    });

    test('annotates accessible name for members-only videos', () => {
      const video = { ...baseVideo, isMembersOnly: true };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      expect(
        screen.getByRole('button', { name: 'Test Video Title - Members-only content (cannot download)' })
      ).toBeInTheDocument();
    });
  });

  describe('Delete Functionality', () => {
    test('calls onDelete with youtubeId when delete icon is clicked', () => {
      render(<VideoChip video={baseVideo} onDelete={mockOnDelete} />);

      const deleteIcon = screen.getByTestId('CloseIcon');
      fireEvent.click(deleteIcon);

      expect(mockOnDelete).toHaveBeenCalledWith('test123');
      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    test('renders delete icon', () => {
      render(<VideoChip video={baseVideo} onDelete={mockOnDelete} />);

      expect(screen.getByTestId('CloseIcon')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('hides duration pill when duration is zero or unknown', () => {
      const video = { ...baseVideo, duration: 0 };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      expect(screen.queryByText('0:00')).not.toBeInTheDocument();
    });

    test('handles very long duration', () => {
      const video = { ...baseVideo, duration: 36125 }; // 10 hours, 2 minutes, 5 seconds
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      expect(screen.getByText('10:02:05')).toBeInTheDocument();
    });

    test('handles empty channel name', () => {
      const video = { ...baseVideo, channelName: '' };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      // Should still render without error
      expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    });

    test('handles empty video title', () => {
      const video = { ...baseVideo, videoTitle: '' };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      // Should still render without error
      expect(screen.getByText('Test Channel')).toBeInTheDocument();
    });

    test('handles channel name exactly at truncation limit', () => {
      const video = { ...baseVideo, channelName: 'a'.repeat(20) };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      expect(screen.getByText('a'.repeat(20))).toBeInTheDocument();
    });

    test('handles video title exactly at truncation limit', () => {
      const video = { ...baseVideo, videoTitle: 'a'.repeat(40) };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      expect(screen.getByText('a'.repeat(40))).toBeInTheDocument();
    });
  });

  describe('Combined States', () => {
    test('handles video that is both downloaded and members-only', () => {
      const video = {
        ...baseVideo,
        isAlreadyDownloaded: true,
        isMembersOnly: true,
      };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      // Should show both icons
      expect(screen.getByTestId('HistoryIcon')).toBeInTheDocument();
      expect(screen.getByTestId('LockIcon')).toBeInTheDocument();
      const chip = screen.getByRole('button', { name: /Test Video Title/i });
      expect(chip).toHaveClass('chip-warning');
    });

    test('renders chip with full width', () => {
      render(<VideoChip video={baseVideo} onDelete={mockOnDelete} />);

      const chip = screen.getByRole('button', { name: /Test Video Title/i });
      expect(chip).toHaveStyle({ width: '100%' });
    });
  });

  describe('Bulk Import Rendering', () => {
    const bulkVideo: VideoInfo = {
      youtubeId: 'dQw4w9WgXcQ',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      channelName: '',
      videoTitle: '',
      duration: 0,
      publishedAt: 0,
      isAlreadyDownloaded: false,
      isMembersOnly: false,
      isBulkImport: true,
    };

    test('renders video ID for bulk import chip', () => {
      render(<VideoChip video={bulkVideo} onDelete={mockOnDelete} />);

      expect(screen.getByText('dQw4w9WgXcQ')).toBeInTheDocument();
    });

    test('renders URL-only import label', () => {
      render(<VideoChip video={bulkVideo} onDelete={mockOnDelete} />);

      expect(screen.getByText('URL-only import')).toBeInTheDocument();
    });

    test('applies default color for bulk import chip', () => {
      render(<VideoChip video={bulkVideo} onDelete={mockOnDelete} />);

      const chip = screen.getByRole('button');
      expect(chip).toHaveClass('chip-default');
    });

    test('exposes full URL as accessible name for bulk import', () => {
      render(<VideoChip video={bulkVideo} onDelete={mockOnDelete} />);

      expect(
        screen.getByRole('button', { name: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
      ).toBeInTheDocument();
    });

    test('calls onDelete with youtubeId for bulk import chip', () => {
      render(<VideoChip video={bulkVideo} onDelete={mockOnDelete} />);

      const deleteIcon = screen.getByTestId('CloseIcon');
      fireEvent.click(deleteIcon);

      expect(mockOnDelete).toHaveBeenCalledWith('dQw4w9WgXcQ');
    });

    test('does not show duration, media type, or history icon for bulk import', () => {
      render(<VideoChip video={bulkVideo} onDelete={mockOnDelete} />);

      expect(screen.queryByText('0:00')).not.toBeInTheDocument();
      expect(screen.queryByTestId('HistoryIcon')).not.toBeInTheDocument();
    });

    test('renders link icon for bulk import chip', () => {
      render(<VideoChip video={bulkVideo} onDelete={mockOnDelete} />);

      expect(screen.getByTestId('LinkIcon')).toBeInTheDocument();
    });

    test('shows a spinner and "Fetching details..." while enriching', () => {
      render(<VideoChip video={bulkVideo} onDelete={mockOnDelete} isEnriching />);

      expect(screen.getByTestId('EnrichingSpinner')).toBeInTheDocument();
      expect(screen.getByText('Fetching details...')).toBeInTheDocument();
      // The link icon should give way to the spinner while enrichment is active.
      expect(screen.queryByTestId('LinkIcon')).not.toBeInTheDocument();
      expect(screen.queryByText('URL-only import')).not.toBeInTheDocument();
    });

    test('shows link icon again if isEnriching is false', () => {
      render(<VideoChip video={bulkVideo} onDelete={mockOnDelete} isEnriching={false} />);

      expect(screen.getByTestId('LinkIcon')).toBeInTheDocument();
      expect(screen.queryByTestId('EnrichingSpinner')).not.toBeInTheDocument();
    });
  });
});
