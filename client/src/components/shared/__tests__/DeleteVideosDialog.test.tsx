import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeleteVideosDialog from '../DeleteVideosDialog';

describe('DeleteVideosDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    onConfirm: mockOnConfirm,
    videoCount: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders dialog when open is true', () => {
      render(<DeleteVideosDialog {...defaultProps} />);

      expect(screen.getByText('Confirm Video Deletion')).toBeInTheDocument();
      expect(screen.getByTestId('WarningIcon')).toBeInTheDocument();
    });

    test('does not render dialog when open is false', () => {
      render(<DeleteVideosDialog {...defaultProps} open={false} />);

      expect(screen.queryByText('Confirm Video Deletion')).not.toBeInTheDocument();
    });

    test('renders warning alert for single video', () => {
      render(<DeleteVideosDialog {...defaultProps} videoCount={1} />);

      expect(screen.getByText(/You are about to permanently delete 1 video from disk/i)).toBeInTheDocument();
    });

    test('renders warning alert for multiple videos', () => {
      render(<DeleteVideosDialog {...defaultProps} videoCount={5} />);

      expect(screen.getByText(/You are about to permanently delete 5 videos from disk/i)).toBeInTheDocument();
    });

    test('renders action items list with singular text for single video', () => {
      render(<DeleteVideosDialog {...defaultProps} videoCount={1} />);

      expect(screen.getByText(/Remove the video file and associated metadata from your disk/i)).toBeInTheDocument();
      expect(screen.getByText(/Mark the video as removed in the database/i)).toBeInTheDocument();
      expect(screen.getByText(/Free up storage space on your system/i)).toBeInTheDocument();
    });

    test('renders action items list with plural text for multiple videos', () => {
      render(<DeleteVideosDialog {...defaultProps} videoCount={3} />);

      expect(screen.getByText(/Remove the video files and associated metadata from your disk/i)).toBeInTheDocument();
      expect(screen.getByText(/Mark the videos as removed in the database/i)).toBeInTheDocument();
    });

    test('renders error alert with warning message', () => {
      render(<DeleteVideosDialog {...defaultProps} />);

      expect(screen.getByText(/This action cannot be undone!/i)).toBeInTheDocument();
    });

    test('renders re-download notice', () => {
      render(<DeleteVideosDialog {...defaultProps} />);

      expect(screen.getByText(/You can re-download deleted videos later if needed/i)).toBeInTheDocument();
    });

    test('renders Cancel button', () => {
      render(<DeleteVideosDialog {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelButton).toBeInTheDocument();
    });

    test('renders Delete button with singular text for single video', () => {
      render(<DeleteVideosDialog {...defaultProps} videoCount={1} />);

      expect(screen.getByRole('button', { name: 'Delete Video' })).toBeInTheDocument();
      expect(screen.getByTestId('DeleteForeverIcon')).toBeInTheDocument();
    });

    test('renders Delete button with plural text for multiple videos', () => {
      render(<DeleteVideosDialog {...defaultProps} videoCount={5} />);

      expect(screen.getByRole('button', { name: 'Delete Videos' })).toBeInTheDocument();
    });
  });

  describe('Dialog Behavior', () => {
    test('calls onClose when Cancel button is clicked', () => {
      render(<DeleteVideosDialog {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    test('calls onConfirm when Delete button is clicked', () => {
      render(<DeleteVideosDialog {...defaultProps} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete Video' });
      fireEvent.click(deleteButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    test('calls onClose when dialog backdrop is clicked', () => {
      render(<DeleteVideosDialog {...defaultProps} />);

      // MUI Dialog calls onClose when clicking outside
      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Video Count Variations', () => {
    test('handles zero video count', () => {
      render(<DeleteVideosDialog {...defaultProps} videoCount={0} />);

      expect(screen.getByText(/You are about to permanently delete 0 videos from disk/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete Videos' })).toBeInTheDocument();
    });

    test('handles large video count', () => {
      render(<DeleteVideosDialog {...defaultProps} videoCount={100} />);

      expect(screen.getByText(/You are about to permanently delete 100 videos from disk/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete Videos' })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('dialog has proper role', () => {
      render(<DeleteVideosDialog {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('buttons have proper roles and labels', () => {
      render(<DeleteVideosDialog {...defaultProps} videoCount={3} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete Videos' })).toBeInTheDocument();
    });
  });
});
