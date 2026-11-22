import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import RescanAnywayDialog from '../RescanAnywayDialog';
import { renderWithProviders } from '../../../../test-utils';

const renderDialog = (overrides: Partial<React.ComponentProps<typeof RescanAnywayDialog>> = {}) => {
  const onClose = jest.fn();
  const onConfirm = jest.fn();
  const props: React.ComponentProps<typeof RescanAnywayDialog> = {
    open: true,
    onClose,
    onConfirm,
    pending: false,
    folderMessage: 'The downloads folder is empty.',
    affected: 16800,
    present: 16801,
    exact: true,
    ...overrides,
  };
  const view = renderWithProviders(<RescanAnywayDialog {...props} />);
  return { onClose, onConfirm, props, rerender: view.rerender, user: userEvent.setup() };
};

const acknowledge = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('checkbox'));

describe('RescanAnywayDialog', () => {
  test('names the folder that looks empty', () => {
    renderDialog({ folderMessage: 'The subfolder __Kids is empty.' });
    expect(screen.getByText(/The subfolder __Kids is empty\./)).toBeInTheDocument();
  });

  test('explains when to use it, and what to do about a moved library instead', () => {
    renderDialog();
    expect(screen.getByText(/Only continue if you removed the files yourself\./)).toBeInTheDocument();
    expect(screen.getByText(/If a drive or network share is unmounted, mount it instead\./)).toBeInTheDocument();
    expect(screen.getByText(/change the volume mapping for the downloads folder/)).toBeInTheDocument();
    expect(screen.getByText(/Changing YOUTUBE_OUTPUT_DIR alone does not move it\./)).toBeInTheDocument();
  });

  test('says how many of the downloaded videos will be marked missing', () => {
    renderDialog();
    expect(screen.getByText('16,800 of your 16,801 downloaded videos will be marked missing.')).toBeInTheDocument();
  });

  test('gives an upper bound when only the videos the rescan cannot find will be marked', () => {
    renderDialog({ folderMessage: null, affected: 300, exact: false });
    expect(screen.getByText(/The last rescan could not find most of the videos stored in a folder\./)).toBeInTheDocument();
    expect(screen.getByText('Up to 300 downloaded videos will be marked missing: every one whose file the rescan cannot find.')).toBeInTheDocument();
  });

  test('asks the user to say they removed the files before it confirms', async () => {
    const { onConfirm, user } = renderDialog();
    const confirm = screen.getByRole('button', { name: 'Rescan anyway' });
    expect(confirm).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'I removed these 16,800 videos\' files myself' }));
    await user.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test('asks again each time it opens', async () => {
    const { props, rerender, user } = renderDialog();
    await acknowledge(user);

    rerender(<RescanAnywayDialog {...props} open={false} />);
    rerender(<RescanAnywayDialog {...props} open />);

    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Rescan anyway' })).toBeDisabled();
  });

  test('cancels', async () => {
    const { onClose, user } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('disables the confirm button while pending', async () => {
    const { user } = renderDialog({ pending: true });
    await acknowledge(user);
    expect(screen.getByRole('button', { name: 'Rescan anyway' })).toBeDisabled();
  });

  test('renders nothing when closed', () => {
    renderDialog({ open: false });
    expect(screen.queryByText('Rescan anyway')).not.toBeInTheDocument();
  });
});
