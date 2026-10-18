import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import RescanAnywayDialog from '../RescanAnywayDialog';
import { renderWithProviders } from '../../../../test-utils';

const renderDialog = (overrides: Partial<React.ComponentProps<typeof RescanAnywayDialog>> = {}) => {
  const onClose = jest.fn();
  const onConfirm = jest.fn();
  renderWithProviders(
    <RescanAnywayDialog open onClose={onClose} onConfirm={onConfirm} pending={false} {...overrides} />
  );
  return { onClose, onConfirm, user: userEvent.setup() };
};

describe('RescanAnywayDialog', () => {
  test('explains when to use it and what it does', () => {
    renderDialog();
    expect(screen.getByText(/Only continue if you removed the files yourself and the downloads folder really is empty\./)).toBeInTheDocument();
    expect(screen.getByText(/If a drive or network share is unmounted, mount it instead\./)).toBeInTheDocument();
    expect(screen.getByText(/Every downloaded video whose file is not found will be marked missing\./)).toBeInTheDocument();
  });

  test('confirms', async () => {
    const { onConfirm, user } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Rescan anyway' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test('cancels', async () => {
    const { onClose, user } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('disables the confirm button while pending', () => {
    renderDialog({ pending: true });
    expect(screen.getByRole('button', { name: 'Rescan anyway' })).toBeDisabled();
  });

  test('renders nothing when closed', () => {
    renderDialog({ open: false });
    expect(screen.queryByText('Rescan anyway')).not.toBeInTheDocument();
  });
});
