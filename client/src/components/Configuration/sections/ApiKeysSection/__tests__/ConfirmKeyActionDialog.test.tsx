import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmKeyActionDialog from '../ConfirmKeyActionDialog';

const renderDialog = (overrides: Partial<React.ComponentProps<typeof ConfirmKeyActionDialog>> = {}) => {
  const props = {
    open: true,
    title: 'Revoke API Key?',
    confirmLabel: 'Revoke',
    busyLabel: 'Revoking…',
    busy: false,
    onCancel: jest.fn(),
    onConfirm: jest.fn(),
    ...overrides,
  };
  render(<ConfirmKeyActionDialog {...props}>Body text</ConfirmKeyActionDialog>);
  return props;
};

describe('ConfirmKeyActionDialog', () => {
  test('confirms the action', async () => {
    const { onConfirm } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(onConfirm).toHaveBeenCalled();
  });

  test('cancels the action', async () => {
    const { onCancel } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalled();
  });

  test('shows the busy label and locks the buttons while working', () => {
    renderDialog({ busy: true });

    expect(screen.getByRole('button', { name: 'Revoking…' })).toBeDisabled();
  });
});
