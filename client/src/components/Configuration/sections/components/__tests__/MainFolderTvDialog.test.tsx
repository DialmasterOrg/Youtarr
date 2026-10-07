import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MainFolderTvDialog } from '../MainFolderTvDialog';

function showDialog(overrides: Partial<React.ComponentProps<typeof MainFolderTvDialog>> = {}) {
  const props = {
    open: true,
    onCancel: jest.fn(),
    onConfirm: jest.fn(),
    ...overrides,
  };
  render(<MainFolderTvDialog {...props} />);
  return props;
}

describe('MainFolderTvDialog', () => {
  test('renders nothing when closed', () => {
    showDialog({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('is titled as a question about the main folder', () => {
    showDialog();
    expect(
      screen.getByRole('dialog', { name: 'Use the main folder for TV shows?' })
    ).toBeInTheDocument();
  });

  test('explains that main folder channels become TV shows', () => {
    showDialog();
    expect(
      screen.getByText(/Every channel saved directly in the main folder becomes a TV show/)
    ).toBeInTheDocument();
  });

  test('explains the Jellyfin and Emby subfolder caveat', () => {
    showDialog();
    expect(screen.getByText(/They can't be excluded per library\./)).toBeInTheDocument();
  });

  test('explains the Plex .plexignore file', () => {
    showDialog();
    expect(screen.getByText(/Youtarr writes a \.plexignore file in the main folder/)).toBeInTheDocument();
  });

  test('describes when to choose this layout', () => {
    showDialog();
    expect(screen.getByText(/Choose this if all your content is TV-style/)).toBeInTheDocument();
  });

  test('uses the confirm label it is given', () => {
    showDialog({ confirmLabel: 'Review the move' });
    expect(screen.getByRole('button', { name: 'Review the move' })).toBeInTheDocument();
  });

  test('confirm calls onConfirm', async () => {
    const user = userEvent.setup();
    const props = showDialog();
    await user.click(screen.getByRole('button', { name: 'Use for TV shows' }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  test('cancel calls onCancel without confirming', async () => {
    const user = userEvent.setup();
    const props = showDialog();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  test('disables both buttons while busy', () => {
    showDialog({ busy: true });
    expect(screen.getByRole('button', { name: 'Use for TV shows' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
