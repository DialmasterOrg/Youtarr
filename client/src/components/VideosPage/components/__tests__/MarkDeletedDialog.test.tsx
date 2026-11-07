import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MarkDeletedDialog from '../MarkDeletedDialog';
import { renderWithProviders } from '../../../../test-utils';

const renderDialog = (overrides: Partial<React.ComponentProps<typeof MarkDeletedDialog>> = {}) => {
  const onClose = jest.fn();
  const onConfirm = jest.fn();
  renderWithProviders(
    <MarkDeletedDialog
      open
      onClose={onClose}
      onConfirm={onConfirm}
      count={2}
      skippedCount={0}
      pending={false}
      {...overrides}
    />
  );
  return { onClose, onConfirm };
};

describe('MarkDeletedDialog', () => {
  test('explains what marking does, in plural', () => {
    renderDialog({ count: 2, skippedCount: 1 });
    expect(screen.getByText('Mark as deleted')).toBeInTheDocument();
    expect(screen.getByText('2 missing videos will be marked as deleted and hidden by default.')).toBeInTheDocument();
    expect(screen.getByText('1 selected video is not missing and will not change.')).toBeInTheDocument();
    expect(screen.getByText('The record is kept, so the video can still be re-downloaded; if its file turns up again, the rescan marks it downloaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark 2 as deleted' })).toBeEnabled();
  });

  test('explains what marking does, in singular, without a skipped note when nothing is skipped', () => {
    renderDialog({ count: 1, skippedCount: 0 });
    expect(screen.getByText('1 missing video will be marked as deleted and hidden by default.')).toBeInTheDocument();
    expect(screen.queryByText(/will not change/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark 1 as deleted' })).toBeInTheDocument();
  });

  test('pluralizes the skipped note', () => {
    renderDialog({ count: 1, skippedCount: 3 });
    expect(screen.getByText('3 selected videos are not missing and will not change.')).toBeInTheDocument();
  });

  test('confirms and cancels', async () => {
    const user = userEvent.setup();
    const { onClose, onConfirm } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Mark 2 as deleted' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('disables the confirm button while pending', () => {
    renderDialog({ pending: true });
    expect(screen.getByRole('button', { name: 'Mark 2 as deleted' })).toBeDisabled();
  });

  test('renders nothing when closed', () => {
    renderDialog({ open: false });
    expect(screen.queryByText('Mark as deleted')).not.toBeInTheDocument();
  });
});
