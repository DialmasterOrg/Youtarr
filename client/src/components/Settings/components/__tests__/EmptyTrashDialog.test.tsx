import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import EmptyTrashDialog from '../EmptyTrashDialog';
import { renderWithProviders } from '../../../../test-utils';

const renderDialog = (overrides: Partial<React.ComponentProps<typeof EmptyTrashDialog>> = {}) => {
  const onClose = jest.fn();
  const onConfirm = jest.fn();
  renderWithProviders(
    <EmptyTrashDialog
      open
      onClose={onClose}
      onConfirm={onConfirm}
      counts={{ deleted: 12, missing: 4 }}
      missingDisabledReason={null}
      archiveRemovalDisabledReason={null}
      pending={false}
      {...overrides}
    />
  );
  return { onClose, onConfirm, user: userEvent.setup() };
};

const confirmButton = () => screen.getByRole('button', { name: /^Empty trash \(/ });

describe('EmptyTrashDialog', () => {
  test('never preselects Missing, even when there are no deleted videos', async () => {
    const { user } = renderDialog({ counts: { deleted: 0, missing: 4 } });

    expect(screen.getByRole('radio', { name: 'Deleted (0)' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Missing (4)' })).toHaveAttribute('aria-checked', 'false');
    await user.click(screen.getByRole('checkbox', { name: 'I understand this cannot be undone' }));
    expect(confirmButton()).toHaveTextContent('Empty trash (0 videos)');
    expect(confirmButton()).toBeDisabled();
  });

  test('warns once Missing is chosen when most of the library is missing, and asks the user to say the files are gone', async () => {
    const warning = '16,800 of your 16,813 downloaded videos are missing.';
    const { onConfirm, user } = renderDialog({ counts: { deleted: 0, missing: 16800 }, missingWarning: warning });

    expect(screen.queryByText(warning)).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Missing (16800)' }));
    expect(screen.getByText(warning)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'I understand this cannot be undone' }));
    expect(confirmButton()).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /^I removed these files myself/ }));
    await user.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledWith({ states: ['missing'], removeFromArchive: false });
  });

  test('asks nothing extra for deleted videos alone', async () => {
    const { user } = renderDialog({ missingWarning: '16,800 of your 16,813 downloaded videos are missing.' });

    await user.click(screen.getByRole('checkbox', { name: 'I understand this cannot be undone' }));

    expect(screen.queryByRole('checkbox', { name: /^I removed these files myself/ })).not.toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
  });

  test('disables removing archive entries with the reason while a download runs, and keeps them', async () => {
    const { onConfirm, user } = renderDialog({ archiveRemovalDisabledReason: 'Unavailable while a download is running.' });

    expect(screen.getByRole('radio', { name: 'Remove them from the download archive' })).toBeDisabled();
    expect(screen.getByText('Unavailable while a download is running.')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'I understand this cannot be undone' }));
    await user.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledWith({ states: ['deleted'], removeFromArchive: false });
  });

  test('starts with Deleted and Keep selected, the confirm button disabled until the risk is acknowledged', async () => {
    const { user } = renderDialog();

    expect(screen.getByRole('radio', { name: 'Deleted (12)' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Keep them in the download archive (recommended)' })).toHaveAttribute('aria-checked', 'true');
    expect(confirmButton()).toHaveTextContent('Empty trash (12 videos)');
    expect(confirmButton()).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'I understand this cannot be undone' }));
    expect(confirmButton()).toBeEnabled();
  });

  test('spells out what happens and that it cannot be undone', () => {
    renderDialog();
    expect(screen.getByText('They disappear from the Videos page and from Download History.')).toBeInTheDocument();
    expect(screen.getByText('Their channel and playlist pages show them as not downloaded.')).toBeInTheDocument();
    expect(screen.getByText('Watch history Youtarr synced for them from your media servers is removed.')).toBeInTheDocument();
    expect(screen.getByText("No files in your downloads folder are touched. If a missing video's file turns up later, Youtarr will not know about it; download it again instead.")).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByText('Automatic channel and playlist downloads keep skipping them, as they do now.')).toBeInTheDocument();
    expect(screen.getByText('Automatic downloads treat them as new and may download them again at the next run.')).toBeInTheDocument();
  });

  test('confirms with the chosen states and archive choice', async () => {
    const { user, onConfirm } = renderDialog();

    await user.click(screen.getByRole('radio', { name: 'Both (16)' }));
    expect(confirmButton()).toHaveTextContent('Empty trash (16 videos)');
    await user.click(screen.getByRole('radio', { name: 'Remove them from the download archive' }));
    await user.click(screen.getByRole('checkbox', { name: 'I understand this cannot be undone' }));
    await user.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledWith({ states: ['deleted', 'missing'], removeFromArchive: true });
  });

  test('confirms missing only, keeping the archive', async () => {
    const { user, onConfirm } = renderDialog();

    await user.click(screen.getByRole('radio', { name: 'Missing (4)' }));
    await user.click(screen.getByRole('checkbox', { name: 'I understand this cannot be undone' }));
    await user.click(confirmButton());

    expect(confirmButton()).toHaveTextContent('Empty trash (4 videos)');
    expect(onConfirm).toHaveBeenCalledWith({ states: ['missing'], removeFromArchive: false });
  });

  test('disables the missing choices and shows why while the downloads folder looks unmounted', () => {
    renderDialog({ missingDisabledReason: 'The downloads folder is empty.' });

    expect(screen.getByRole('radio', { name: 'Missing (4)' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Both (16)' })).toBeDisabled();
    expect(screen.getByText('The downloads folder is empty.')).toBeInTheDocument();
  });

  test('disables the missing choices when there are no missing videos', () => {
    renderDialog({ counts: { deleted: 1, missing: 0 } });

    expect(screen.getByRole('radio', { name: 'Missing (0)' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Both (1)' })).toBeDisabled();
    expect(confirmButton()).toHaveTextContent('Empty trash (1 video)');
  });

  test('keeps the confirm button disabled while pending', async () => {
    const { user } = renderDialog({ pending: true });
    await user.click(screen.getByRole('checkbox', { name: 'I understand this cannot be undone' }));
    expect(confirmButton()).toBeDisabled();
  });

  test('cancels', async () => {
    const { user, onClose } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('renders nothing when closed', () => {
    renderDialog({ open: false });
    expect(screen.queryByText('Empty trash')).not.toBeInTheDocument();
  });
});
