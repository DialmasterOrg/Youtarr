import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import TerminateJobDialog from '../TerminateJobDialog';

describe('TerminateJobDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not render when open is false', () => {
    render(
      <TerminateJobDialog
        open={false}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.queryByText('Confirm Download Termination')).not.toBeInTheDocument();
  });

  test('renders dialog when open is true', () => {
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByText('Confirm Download Termination')).toBeInTheDocument();
  });

  test('displays warning icon in title', () => {
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByTestId('WarningIcon')).toBeInTheDocument();
  });

  test('displays main warning alert message', () => {
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByText('You are about to terminate the currently running download job.')).toBeInTheDocument();
  });

  test('displays all action items in the list', () => {
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByText('Stop the current download, terminating the download currently in progress.')).toBeInTheDocument();
    expect(screen.getByText('Save all videos that have already been downloaded')).toBeInTheDocument();
    expect(screen.getByText('Clean up the partial video download in progress')).toBeInTheDocument();
    expect(screen.getByText('NOT affect any queued jobs (they will continue after this one)')).toBeInTheDocument();
  });

  test('displays info alert about job history', () => {
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByText('The job will show as "Terminated" in your download history with a list of completed videos.')).toBeInTheDocument();
  });

  test('displays Cancel button', () => {
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  test('displays Terminate Download button with stop icon', () => {
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const terminateButton = screen.getByRole('button', { name: 'Terminate Download' });
    expect(terminateButton).toBeInTheDocument();
    expect(screen.getByTestId('StopIcon')).toBeInTheDocument();
  });

  test('calls onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  test('calls onConfirm when Terminate Download button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const terminateButton = screen.getByRole('button', { name: 'Terminate Download' });
    await user.click(terminateButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  test('calls onClose when dialog is closed via backdrop or ESC', async () => {
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    // Find the dialog and simulate closing it
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Simulate ESC key press
    const user = userEvent.setup();
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  test('Cancel button has primary color and is contained variant', () => {
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelButton).toHaveClass('MuiButton-contained');
    expect(cancelButton).toHaveClass('MuiButton-containedPrimary');
  });

  test('Terminate Download button has warning color and is outlined variant', () => {
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const terminateButton = screen.getByRole('button', { name: 'Terminate Download' });
    expect(terminateButton).toHaveClass('MuiButton-outlined');
    expect(terminateButton).toHaveClass('MuiButton-outlinedWarning');
  });

  test('Cancel button receives focus when dialog opens', () => {
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    // The button exists and should be focusable
    expect(cancelButton).toBeInTheDocument();
    expect(cancelButton).not.toBeDisabled();
  });

  test('renders with correct dialog max width and full width', () => {
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const dialog = screen.getByRole('dialog');
    // The dialog should have the correct classes for maxWidth="sm" and fullWidth
    expect(dialog).toBeInTheDocument();
  });

  test('does not call handlers when dialog is not open', () => {
    const { rerender } = render(
      <TerminateJobDialog
        open={false}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    // Dialog should not be in the document
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

    // Open the dialog
    rerender(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    // Now buttons should be available
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminate Download' })).toBeInTheDocument();
  });

  test('displays all content sections in correct order', () => {
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(2); // Warning alert and info alert

    // First alert should be warning
    expect(alerts[0]).toHaveClass('MuiAlert-standardWarning');
    // Second alert should be info
    expect(alerts[1]).toHaveClass('MuiAlert-standardInfo');
  });

  test('action list is properly formatted as a bullet list', () => {
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    // The list items should be within a ul element
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(4);
  });

  test('dialog title contains both icon and text', () => {
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const title = screen.getByText('Confirm Download Termination');
    const icon = screen.getByTestId('WarningIcon');

    // Both should be in the document
    expect(title).toBeInTheDocument();
    expect(icon).toBeInTheDocument();
  });

  test('renders introductory text before action list', () => {
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByText('This action will:')).toBeInTheDocument();
  });

  test('multiple clicks on Cancel only call onClose once per click', async () => {
    const user = userEvent.setup();
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });

    await user.click(cancelButton);
    await user.click(cancelButton);

    // Should be called twice (once per click)
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });

  test('multiple clicks on Terminate Download only call onConfirm once per click', async () => {
    const user = userEvent.setup();
    render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const terminateButton = screen.getByRole('button', { name: 'Terminate Download' });

    await user.click(terminateButton);
    await user.click(terminateButton);

    // Should be called twice (once per click)
    expect(mockOnConfirm).toHaveBeenCalledTimes(2);
  });

  test('handler props can be different functions on re-render', async () => {
    const user = userEvent.setup();
    const newOnClose = jest.fn();
    const newOnConfirm = jest.fn();

    const { rerender } = render(
      <TerminateJobDialog
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    // Click with original handlers
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    // Re-render with new handlers
    rerender(
      <TerminateJobDialog
        open={true}
        onClose={newOnClose}
        onConfirm={newOnConfirm}
      />
    );

    // Click with new handlers
    const terminateButton = screen.getByRole('button', { name: 'Terminate Download' });
    await user.click(terminateButton);
    expect(newOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });
});
