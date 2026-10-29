import React from 'react';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import AddSubfolderDialog from '../AddSubfolderDialog';

const render = (ui: ReactElement) => rtlRender(ui, { wrapper: MemoryRouter });

describe('AddSubfolderDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnAdd = jest.fn();

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    onAdd: mockOnAdd,
    existingSubfolders: ['__Sports', '__Music'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders dialog when open is true', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: 'Add library folder' })).toBeInTheDocument();
      expect(screen.getByLabelText('Library folder name')).toBeInTheDocument();
      expect(screen.getByText(/Creates a Videos folder\. To make a TV show folder, use/)).toBeInTheDocument();
      const link = screen.getByRole('link', { name: 'Settings > Library folders (opens in a new tab)' });
      expect(link).toHaveAttribute('href', '/settings/library');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add library folder' })).toBeInTheDocument();
    });

    test('does not render dialog when open is false', () => {
      render(<AddSubfolderDialog {...defaultProps} open={false} />);

      expect(screen.queryByText('Add library folder')).not.toBeInTheDocument();
    });

    test('renders helper text when input is empty', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      expect(
        screen.getByText('Enter a name for the new library folder (e.g., Sports, Music)')
      ).toBeInTheDocument();
    });

    test('Add button is disabled when input is empty', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const addButton = screen.getByRole('button', { name: 'Add library folder' });
      expect(addButton).toBeDisabled();
    });
  });

  describe('Validation', () => {
    test('shows error for whitespace-only input', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Library folder name');
      fireEvent.change(input, { target: { value: '   ' } });

      expect(screen.getByText('Library folder name cannot be empty')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add library folder' })).toBeDisabled();
    });

    test('shows error for duplicate library folder name (case-insensitive)', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Library folder name');
      fireEvent.change(input, { target: { value: 'sports' } });

      expect(screen.getByText('A library folder with this name already exists')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add library folder' })).toBeDisabled();
    });

    test('shows error for reserved __ prefix', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Library folder name');
      fireEvent.change(input, { target: { value: '__Sports' } });

      expect(screen.getByText('Library folder names cannot start with __ (reserved prefix)')).toBeInTheDocument();
    });

    test('shows error for invalid characters', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Library folder name');
      fireEvent.change(input, { target: { value: 'Sports/2024' } });

      expect(
        screen.getByText('Library folder name can only contain letters, numbers, spaces, hyphens, and underscores')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add library folder' })).toBeDisabled();
    });

    test('shows error for name exceeding 100 characters', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Library folder name');
      fireEvent.change(input, { target: { value: 'a'.repeat(101) } });

      expect(screen.getByText('Name cannot exceed 100 characters')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add library folder' })).toBeDisabled();
    });

    test('allows valid input up to 100 characters', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Library folder name');
      fireEvent.change(input, { target: { value: 'a'.repeat(100) } });

      expect(screen.queryByText(/cannot exceed/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add library folder' })).toBeEnabled();
    });

    test('enables Add button when valid name entered', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Library folder name');
      fireEvent.change(input, { target: { value: 'Gaming' } });

      expect(screen.getByRole('button', { name: 'Add library folder' })).toBeEnabled();
    });
  });

  describe('Interaction', () => {
    test('calls onClose when Cancel clicked', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnAdd).not.toHaveBeenCalled();
    });

    test('calls onAdd with trimmed value when Add clicked', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Library folder name');
      fireEvent.change(input, { target: { value: '  Gaming  ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add library folder' }));

      expect(mockOnAdd).toHaveBeenCalledWith('Gaming');
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    test('calls onAdd when Enter key pressed with valid input', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Library folder name');
      fireEvent.change(input, { target: { value: 'Gaming' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      expect(mockOnAdd).toHaveBeenCalledWith('Gaming');
    });

    test('does not call onAdd when Enter pressed with invalid input', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Library folder name');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      expect(mockOnAdd).not.toHaveBeenCalled();
    });

    test('clears input when dialog reopens', () => {
      const { rerender } = render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Library folder name');
      fireEvent.change(input, { target: { value: 'Gaming' } });

      // Close and reopen
      rerender(<AddSubfolderDialog {...defaultProps} open={false} />);
      rerender(<AddSubfolderDialog {...defaultProps} open={true} />);

      const newInput = screen.getByLabelText('Library folder name');
      expect(newInput).toHaveValue('');
    });

    test('calls onClose when dialog backdrop is clicked (escape key)', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty existingSubfolders array', () => {
      render(<AddSubfolderDialog {...defaultProps} existingSubfolders={[]} />);

      const input = screen.getByLabelText('Library folder name');
      fireEvent.change(input, { target: { value: 'Sports' } });

      // Should be valid since there are no existing subfolders
      expect(screen.getByRole('button', { name: 'Add library folder' })).toBeEnabled();
    });

    test('handles subfolders without __ prefix in existingSubfolders', () => {
      render(<AddSubfolderDialog {...defaultProps} existingSubfolders={['Sports', 'Music']} />);

      const input = screen.getByLabelText('Library folder name');
      fireEvent.change(input, { target: { value: 'Sports' } });

      expect(screen.getByText('A library folder with this name already exists')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('dialog has proper role', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('input has proper label', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      expect(screen.getByLabelText('Library folder name')).toBeInTheDocument();
    });

    test('buttons have proper accessible names', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add library folder' })).toBeInTheDocument();
    });
  });
});
