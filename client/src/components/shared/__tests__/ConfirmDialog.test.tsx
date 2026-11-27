import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '../ConfirmDialog';

const renderDialog = (overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) => {
  const props = {
    open: true,
    title: 'Revoke API Key?',
    confirmLabel: 'Revoke',
    onCancel: jest.fn(),
    onConfirm: jest.fn(),
    ...overrides,
  };
  render(<ConfirmDialog {...props}>Body text</ConfirmDialog>);
  return props;
};

describe('ConfirmDialog', () => {
  test('names the dialog by its title and describes it by its body', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Revoke API Key?' });
    expect(dialog).toHaveAccessibleDescription('Body text');
  });

  test('confirms the action', async () => {
    const { onConfirm } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(onConfirm).toHaveBeenCalled();
  });

  test('cancels the action', async () => {
    const { onCancel } = renderDialog({ cancelLabel: 'Later' });

    await userEvent.click(screen.getByRole('button', { name: 'Later' }));

    expect(onCancel).toHaveBeenCalled();
  });

  test('a harmless confirm fills the action and leaves Cancel plain', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Revoke' })).toHaveClass('btn-contained-primary');
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toHaveClass('btn-contained');
  });

  test('a destructive confirm fills and focuses Cancel and outlines the action in red', () => {
    renderDialog({ tone: 'danger' });

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel).toHaveClass('btn-contained-primary');
    expect(cancel).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Revoke' })).toHaveClass('btn-outlined-error');
  });

  test('a reversible confirm outlines the action in amber', () => {
    renderDialog({ tone: 'warning' });

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('btn-contained-primary');
    expect(screen.getByRole('button', { name: 'Revoke' })).toHaveClass('btn-outlined-warning');
  });

  test('shows the busy label and locks both buttons while working', () => {
    renderDialog({ busy: true, busyLabel: 'Revoking...' });

    expect(screen.getByRole('button', { name: 'Revoking...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  test('disables only the action when it is not allowed yet', () => {
    renderDialog({ confirmDisabled: true });

    expect(screen.getByRole('button', { name: 'Revoke' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });
});
