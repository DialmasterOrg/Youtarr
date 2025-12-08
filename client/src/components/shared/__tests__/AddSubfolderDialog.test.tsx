import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddSubfolderDialog from '../AddSubfolderDialog';

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

      expect(screen.getByText('Add New Subfolder')).toBeInTheDocument();
      expect(screen.getByLabelText('Subfolder Name')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add Subfolder' })).toBeInTheDocument();
    });

    test('does not render dialog when open is false', () => {
      render(<AddSubfolderDialog {...defaultProps} open={false} />);

      expect(screen.queryByText('Add New Subfolder')).not.toBeInTheDocument();
    });

    test('renders helper text when input is empty', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      expect(
        screen.getByText('Enter a name for the new subfolder (e.g., Sports, Music)')
      ).toBeInTheDocument();
    });

    test('Add button is disabled when input is empty', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const addButton = screen.getByRole('button', { name: 'Add Subfolder' });
      expect(addButton).toBeDisabled();
    });
  });

  describe('Validation', () => {
    test('shows error for whitespace-only input', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Subfolder Name');
      fireEvent.change(input, { target: { value: '   ' } });

      expect(screen.getByText('Subfolder name cannot be empty')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add Subfolder' })).toBeDisabled();
    });

    test('shows error for duplicate subfolder name (case-insensitive)', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Subfolder Name');
      fireEvent.change(input, { target: { value: 'sports' } });

      expect(screen.getByText('A subfolder with this name already exists')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add Subfolder' })).toBeDisabled();
    });

    test('shows error for reserved __ prefix', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Subfolder Name');
      fireEvent.change(input, { target: { value: '__Sports' } });

      expect(screen.getByText('Subfolder names cannot start with __ (reserved prefix)')).toBeInTheDocument();
    });

    test('shows error for invalid characters', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Subfolder Name');
      fireEvent.change(input, { target: { value: 'Sports/2024' } });

      expect(
        screen.getByText('Subfolder name can only contain letters, numbers, spaces, hyphens, and underscores')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add Subfolder' })).toBeDisabled();
    });

    test('shows error for name exceeding 100 characters', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Subfolder Name');
      fireEvent.change(input, { target: { value: 'a'.repeat(101) } });

      expect(screen.getByText('Name cannot exceed 100 characters')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add Subfolder' })).toBeDisabled();
    });

    test('allows valid input up to 100 characters', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Subfolder Name');
      fireEvent.change(input, { target: { value: 'a'.repeat(100) } });

      expect(screen.queryByText(/cannot exceed/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add Subfolder' })).toBeEnabled();
    });

    test('enables Add button when valid name entered', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Subfolder Name');
      fireEvent.change(input, { target: { value: 'Gaming' } });

      expect(screen.getByRole('button', { name: 'Add Subfolder' })).toBeEnabled();
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

      const input = screen.getByLabelText('Subfolder Name');
      fireEvent.change(input, { target: { value: '  Gaming  ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Subfolder' }));

      expect(mockOnAdd).toHaveBeenCalledWith('Gaming');
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    test('calls onAdd when Enter key pressed with valid input', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Subfolder Name');
      fireEvent.change(input, { target: { value: 'Gaming' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      expect(mockOnAdd).toHaveBeenCalledWith('Gaming');
    });

    test('does not call onAdd when Enter pressed with invalid input', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Subfolder Name');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      expect(mockOnAdd).not.toHaveBeenCalled();
    });

    test('clears input when dialog reopens', () => {
      const { rerender } = render(<AddSubfolderDialog {...defaultProps} />);

      const input = screen.getByLabelText('Subfolder Name');
      fireEvent.change(input, { target: { value: 'Gaming' } });

      // Close and reopen
      rerender(<AddSubfolderDialog {...defaultProps} open={false} />);
      rerender(<AddSubfolderDialog {...defaultProps} open={true} />);

      const newInput = screen.getByLabelText('Subfolder Name');
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

      const input = screen.getByLabelText('Subfolder Name');
      fireEvent.change(input, { target: { value: 'Sports' } });

      // Should be valid since there are no existing subfolders
      expect(screen.getByRole('button', { name: 'Add Subfolder' })).toBeEnabled();
    });

    test('handles subfolders without __ prefix in existingSubfolders', () => {
      render(<AddSubfolderDialog {...defaultProps} existingSubfolders={['Sports', 'Music']} />);

      const input = screen.getByLabelText('Subfolder Name');
      fireEvent.change(input, { target: { value: 'Sports' } });

      expect(screen.getByText('A subfolder with this name already exists')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('dialog has proper role', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('input has proper label', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      expect(screen.getByLabelText('Subfolder Name')).toBeInTheDocument();
    });

    test('buttons have proper accessible names', () => {
      render(<AddSubfolderDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add Subfolder' })).toBeInTheDocument();
    });
  });
});
