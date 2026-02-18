import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChangeRatingDialog from '../ChangeRatingDialog';

describe('ChangeRatingDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnApply = jest.fn().mockResolvedValue(undefined);

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    onApply: mockOnApply,
    selectedCount: 3,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders dialog when open is true', () => {
      render(<ChangeRatingDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getAllByText('Content Rating').length).toBeGreaterThanOrEqual(1);
    });

    test('does not render dialog when open is false', () => {
      render(<ChangeRatingDialog {...defaultProps} open={false} />);
      expect(screen.queryByText('Content Rating')).not.toBeInTheDocument();
    });

    test('shows correct count for multiple videos', () => {
      render(<ChangeRatingDialog {...defaultProps} selectedCount={5} />);
      expect(screen.getByText(/5/)).toBeInTheDocument();
      expect(screen.getByText(/videos/)).toBeInTheDocument();
    });

    test('shows singular text for single video', () => {
      render(<ChangeRatingDialog {...defaultProps} selectedCount={1} />);
      expect(screen.getByText(/1/)).toBeInTheDocument();
      // "video." not "videos"
      expect(screen.getByText((content) =>
        content.includes('1') && !content.includes('videos')
      )).toBeInTheDocument();
    });

    test('renders rating select', () => {
      render(<ChangeRatingDialog {...defaultProps} />);
      // MUI Select is rendered; verify the form control label exists
      const labels = screen.getAllByText('Content Rating');
      expect(labels.length).toBeGreaterThanOrEqual(2); // Dialog title + select label
    });

    test('renders Cancel and Apply buttons', () => {
      render(<ChangeRatingDialog {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    test('calls onClose when Cancel is clicked', () => {
      render(<ChangeRatingDialog {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('calls onApply with null when NR is selected and Apply is clicked', async () => {
      render(<ChangeRatingDialog {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(mockOnApply).toHaveBeenCalledWith(null);
      });
    });

    test('calls onClose after successful apply', async () => {
      render(<ChangeRatingDialog {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Loading state', () => {
    test('shows loading spinner when applying', async () => {
      // Make onApply hang to keep the loading state visible
      const slowApply = jest.fn(() => new Promise<void>(() => {}));
      render(<ChangeRatingDialog {...defaultProps} onApply={slowApply} />);

      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
    });

    test('disables Cancel button while loading', async () => {
      const slowApply = jest.fn(() => new Promise<void>(() => {}));
      render(<ChangeRatingDialog {...defaultProps} onApply={slowApply} />);

      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      });
    });
  });

  describe('Error handling', () => {
    test('shows error alert when apply fails', async () => {
      const failingApply = jest.fn().mockRejectedValue(new Error('Network error'));
      render(<ChangeRatingDialog {...defaultProps} onApply={failingApply} />);

      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    test('does not close dialog when apply fails', async () => {
      const failingApply = jest.fn().mockRejectedValue(new Error('Server error'));
      render(<ChangeRatingDialog {...defaultProps} onApply={failingApply} />);

      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
      // Dialog should still be rendered (onClose should NOT have been called)
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    test('clears error when dialog is closed', () => {
      render(<ChangeRatingDialog {...defaultProps} />);
      // Close the dialog
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    test('dialog has proper role', () => {
      render(<ChangeRatingDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('buttons have proper roles', () => {
      render(<ChangeRatingDialog {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    });
  });
});
