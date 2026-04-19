import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { UnsavedChangesDialog } from '../UnsavedChangesDialog';
import { renderWithProviders } from '../../../../test-utils';

describe('UnsavedChangesDialog', () => {
  const baseProps = {
    open: true,
    isSaving: false,
    validationError: null as string | null,
    onDiscard: jest.fn(),
    onCancel: jest.fn(),
    onSave: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the title and the three action buttons when open', () => {
    renderWithProviders(<UnsavedChangesDialog {...baseProps} />);

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /discard changes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save and continue/i })).toBeInTheDocument();
  });

  test('renders nothing when open is false', () => {
    renderWithProviders(<UnsavedChangesDialog {...baseProps} open={false} />);

    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save and continue/i })).not.toBeInTheDocument();
  });

  test('clicking Discard changes calls onDiscard', async () => {
    const onDiscard = jest.fn();
    const user = userEvent.setup();
    renderWithProviders(<UnsavedChangesDialog {...baseProps} onDiscard={onDiscard} />);

    await user.click(screen.getByRole('button', { name: /discard changes/i }));

    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  test('clicking Cancel calls onCancel', async () => {
    const onCancel = jest.fn();
    const user = userEvent.setup();
    renderWithProviders(<UnsavedChangesDialog {...baseProps} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('clicking Save and continue calls onSave', async () => {
    const onSave = jest.fn();
    const user = userEvent.setup();
    renderWithProviders(<UnsavedChangesDialog {...baseProps} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /save and continue/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  test('disables Save and continue when validationError is present', () => {
    renderWithProviders(
      <UnsavedChangesDialog {...baseProps} validationError="Plex URL is required" />
    );

    expect(screen.getByRole('button', { name: /save and continue/i })).toBeDisabled();
  });

  test('shows validationError text when present', () => {
    renderWithProviders(
      <UnsavedChangesDialog {...baseProps} validationError="Plex URL is required" />
    );

    expect(screen.getByText('Plex URL is required')).toBeInTheDocument();
  });

  test('still allows Discard and Cancel when validationError is present', () => {
    renderWithProviders(
      <UnsavedChangesDialog {...baseProps} validationError="Plex URL is required" />
    );

    expect(screen.getByRole('button', { name: /discard changes/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /^cancel$/i })).not.toBeDisabled();
  });

  test('disables all buttons while isSaving', () => {
    renderWithProviders(<UnsavedChangesDialog {...baseProps} isSaving={true} />);

    expect(screen.getByRole('button', { name: /save and continue/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /discard changes/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeDisabled();
  });
});
