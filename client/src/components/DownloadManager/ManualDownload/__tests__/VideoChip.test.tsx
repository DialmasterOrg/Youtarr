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

    test('truncates long channel names', () => {
      const video = {
        ...baseVideo,
        channelName: 'This is a very long channel name that should be truncated',
      };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      expect(screen.getByText('This is a very lo...')).toBeInTheDocument();
    });

    test('truncates long video titles', () => {
      const video = {
        ...baseVideo,
        videoTitle: 'This is a very long video title that should definitely be truncated after a certain number of characters',
      };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      expect(screen.getByText('This is a very long video title that ...')).toBeInTheDocument();
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
      expect(chip).toHaveClass('MuiChip-colorWarning');
    });

    test('applies error color for members-only videos', () => {
      const video = { ...baseVideo, isMembersOnly: true };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      const chip = screen.getByRole('button', { name: /Test Video Title/i });
      expect(chip).toHaveClass('MuiChip-colorError');
    });

    test('applies default color for regular videos', () => {
      render(<VideoChip video={baseVideo} onDelete={mockOnDelete} />);

      const chip = screen.getByRole('button', { name: /Test Video Title/i });
      expect(chip).toHaveClass('MuiChip-colorDefault');
    });

    test('applies filled variant for downloaded videos', () => {
      const video = { ...baseVideo, isAlreadyDownloaded: true };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      const chip = screen.getByRole('button', { name: /Test Video Title/i });
      expect(chip).toHaveClass('MuiChip-filled');
    });

    test('applies filled variant for members-only videos', () => {
      const video = { ...baseVideo, isMembersOnly: true };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      const chip = screen.getByRole('button', { name: /Test Video Title/i });
      expect(chip).toHaveClass('MuiChip-filled');
    });

    test('applies filled variant for regular videos', () => {
      render(<VideoChip video={baseVideo} onDelete={mockOnDelete} />);

      const chip = screen.getByRole('button', { name: /Test Video Title/i });
      expect(chip).toHaveClass('MuiChip-filled');
    });
  });

  describe('Tooltip', () => {
    test('shows basic tooltip with video title', async () => {
      render(<VideoChip video={baseVideo} onDelete={mockOnDelete} />);

      const chip = screen.getByRole('button');
      fireEvent.mouseOver(chip);

      expect(await screen.findByRole('tooltip')).toHaveTextContent('Test Video Title');
    });

    test('shows tooltip for already downloaded videos', async () => {
      const video = { ...baseVideo, isAlreadyDownloaded: true };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      const chip = screen.getByRole('button', { name: /Test Video Title - Already downloaded/i });
      fireEvent.mouseOver(chip);

      expect(await screen.findByRole('tooltip')).toHaveTextContent('Test Video Title - Already downloaded');
    });

    test('shows tooltip for members-only videos', async () => {
      const video = { ...baseVideo, isMembersOnly: true };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      const chip = screen.getByRole('button');
      fireEvent.mouseOver(chip);

      expect(await screen.findByRole('tooltip')).toHaveTextContent('Test Video Title - Members-only content (cannot download)');
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
    test('handles zero duration', () => {
      const video = { ...baseVideo, duration: 0 };
      render(<VideoChip video={video} onDelete={mockOnDelete} />);

      expect(screen.getByText('0:00')).toBeInTheDocument();
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
      expect(chip).toHaveClass('MuiChip-colorWarning');
    });

    test('renders chip with full width', () => {
      render(<VideoChip video={baseVideo} onDelete={mockOnDelete} />);

      const chip = screen.getByRole('button', { name: /Test Video Title/i });
      expect(chip).toHaveStyle({ width: '100%' });
    });
  });
});