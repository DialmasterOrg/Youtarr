import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoActionsDropdown from '../VideoActionsDropdown';

describe('VideoActionsDropdown', () => {
  const mockOnContentRating = jest.fn();
  const mockOnDelete = jest.fn();

  const defaultProps = {
    selectedVideosCount: 3,
    onContentRating: mockOnContentRating,
    onDelete: mockOnDelete,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders the Actions button with count', () => {
      render(<VideoActionsDropdown {...defaultProps} />);
      expect(screen.getByRole('button', { name: /Actions/i })).toBeInTheDocument();
      expect(screen.getByText('Actions (3)')).toBeInTheDocument();
    });

    test('button is disabled when selectedVideosCount is 0', () => {
      render(<VideoActionsDropdown {...defaultProps} selectedVideosCount={0} />);
      expect(screen.getByRole('button', { name: /Actions/i })).toBeDisabled();
    });

    test('button is disabled when disabled prop is true', () => {
      render(<VideoActionsDropdown {...defaultProps} disabled />);
      expect(screen.getByRole('button', { name: /Actions/i })).toBeDisabled();
    });

    test('menu is not visible initially', () => {
      render(<VideoActionsDropdown {...defaultProps} />);
      expect(screen.queryByText('Update Content Rating')).not.toBeInTheDocument();
    });
  });

  describe('Menu interactions', () => {
    test('opens menu when button is clicked', () => {
      render(<VideoActionsDropdown {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Actions/i }));

      expect(screen.getByText('Update Content Rating')).toBeInTheDocument();
      expect(screen.getByText('Delete Selected')).toBeInTheDocument();
    });

    test('calls onContentRating when "Update Content Rating" is clicked', () => {
      render(<VideoActionsDropdown {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Actions/i }));
      fireEvent.click(screen.getByText('Update Content Rating'));

      expect(mockOnContentRating).toHaveBeenCalledTimes(1);
    });

    test('calls onDelete when "Delete Selected" is clicked', () => {
      render(<VideoActionsDropdown {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Actions/i }));
      fireEvent.click(screen.getByText('Delete Selected'));

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    test('closes menu without calling callbacks when clicking away', () => {
      render(<VideoActionsDropdown {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Actions/i }));

      // Press Escape to close
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

      expect(mockOnContentRating).not.toHaveBeenCalled();
      expect(mockOnDelete).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    test('button has aria-label', () => {
      render(<VideoActionsDropdown {...defaultProps} />);
      const button = screen.getByRole('button', { name: /Actions for 3 selected videos/i });
      expect(button).toBeInTheDocument();
    });

    test('button has aria-haspopup attribute', () => {
      render(<VideoActionsDropdown {...defaultProps} />);
      const button = screen.getByRole('button', { name: /Actions/i });
      expect(button).toHaveAttribute('aria-haspopup', 'true');
    });

    test('uses singular text for single video', () => {
      render(<VideoActionsDropdown {...defaultProps} selectedVideosCount={1} />);
      expect(screen.getByText('Actions (1)')).toBeInTheDocument();
      const button = screen.getByRole('button', { name: /Actions for 1 selected video$/i });
      expect(button).toBeInTheDocument();
    });

    test('menu items have proper icons', () => {
      render(<VideoActionsDropdown {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Actions/i }));

      expect(screen.getByTestId('EighteenUpRatingIcon')).toBeInTheDocument();
      expect(screen.getByTestId('DeleteIcon')).toBeInTheDocument();
    });
  });
});
