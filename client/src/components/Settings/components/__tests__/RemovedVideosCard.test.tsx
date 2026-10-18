import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import RemovedVideosCard from '../RemovedVideosCard';
import { renderWithProviders } from '../../../../test-utils';
import type { RemovedVideosSummary, UseRemovedVideosReturn } from '../../hooks/useRemovedVideos';

jest.mock('../../hooks/useRemovedVideos', () => ({
  useRemovedVideos: jest.fn(),
}));

const { useRemovedVideos } = require('../../hooks/useRemovedVideos') as {
  useRemovedVideos: jest.Mock<UseRemovedVideosReturn, [string | null]>;
};

const summary = (overrides: Partial<RemovedVideosSummary> = {}): RemovedVideosSummary => ({
  deleted: 12,
  missing: 4,
  legacy: 0,
  libraryCheck: { ok: true, reason: null, path: null, message: null },
  ...overrides,
});

function setup(summaryValue: RemovedVideosSummary | null = summary(), overrides: Partial<UseRemovedVideosReturn> = {}) {
  const hook: UseRemovedVideosReturn = {
    summary: summaryValue,
    loading: false,
    error: null,
    refetch: jest.fn().mockResolvedValue(undefined),
    markAllMissingDeleted: jest.fn().mockResolvedValue({ updated: 4 }),
    emptyTrash: jest.fn().mockResolvedValue({ purged: 16, archiveEntriesRemoved: 16, jobsAffected: 2 }),
    actionPending: false,
    actionError: null,
    ...overrides,
  };
  useRemovedVideos.mockReturnValue(hook);
  renderWithProviders(<RemovedVideosCard token="tok" />);
  return { hook, user: userEvent.setup() };
}

describe('RemovedVideosCard', () => {
  beforeEach(() => jest.clearAllMocks());

  test('explains the two states and shows the counts', () => {
    setup();
    expect(screen.getByText('Deleted and missing videos')).toBeInTheDocument();
    expect(screen.getByText(/Deleted means Youtarr removed the file/)).toBeInTheDocument();
    expect(screen.getByText('Deleted: 12. Missing: 4.')).toBeInTheDocument();
  });

  test('says how many deleted videos predate the reason being recorded', () => {
    setup(summary({ legacy: 3 }));
    expect(screen.getByText('Deleted: 12 (3 removed before Youtarr recorded why). Missing: 4.')).toBeInTheDocument();
  });

  test('disables the missing action with the warning while the downloads folder looks unmounted', () => {
    setup(summary({ libraryCheck: { ok: false, reason: 'empty', path: '/d', message: 'The downloads folder /d is empty.' } }));
    expect(screen.getByText('The downloads folder /d is empty. Marking or emptying missing videos is disabled until it is back.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark all missing as deleted' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Empty trash...' })).toBeEnabled();
  });

  test('disables both actions when the trash is empty', () => {
    setup(summary({ deleted: 0, missing: 0 }));
    expect(screen.getByRole('button', { name: 'Mark all missing as deleted' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Empty trash...' })).toBeDisabled();
  });

  test('marks all missing videos as deleted after a confirmation that explains it', async () => {
    const { hook, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Mark all missing as deleted' }));
    expect(screen.getByText('Mark all missing videos as deleted')).toBeInTheDocument();
    expect(screen.getByText(/4 missing videos will be marked as deleted and hidden from the Videos page by default\./)).toBeInTheDocument();
    expect(screen.getByText(/Only do this if the files are really gone, not sitting on an unmounted drive\./)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mark 4 as deleted' }));

    expect(hook.markAllMissingDeleted).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Marked 4 videos as deleted.')).toBeInTheDocument();
  });

  test('empties the trash through the dialog and reports what went', async () => {
    const { hook, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Empty trash...' }));
    expect(screen.getByText('Empty trash')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Both (16)' }));
    await user.click(screen.getByRole('radio', { name: 'Remove them from the download archive' }));
    await user.click(screen.getByRole('checkbox', { name: 'I understand this cannot be undone' }));
    await user.click(screen.getByRole('button', { name: 'Empty trash (16 videos)' }));

    expect(hook.emptyTrash).toHaveBeenCalledWith({ states: ['deleted', 'missing'], removeFromArchive: true });
    expect(await screen.findByText('Emptied trash: 16 videos removed, 16 download archive entries removed.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Empty trash')).not.toBeInTheDocument());
  });

  test('reports an emptied trash without archive changes', async () => {
    const { user } = setup(summary(), {
      emptyTrash: jest.fn().mockResolvedValue({ purged: 1, archiveEntriesRemoved: 0, jobsAffected: 0 }),
    });

    await user.click(screen.getByRole('button', { name: 'Empty trash...' }));
    await user.click(screen.getByRole('checkbox', { name: 'I understand this cannot be undone' }));
    await user.click(screen.getByRole('button', { name: 'Empty trash (12 videos)' }));

    expect(await screen.findByText('Emptied trash: 1 video removed.')).toBeInTheDocument();
  });

  test('shows an action error', () => {
    setup(summary(), { actionError: 'A purge is already running' });
    expect(screen.getByText('A purge is already running')).toBeInTheDocument();
  });

  test('shows a load error', () => {
    setup(null, { error: 'Failed to load the deleted and missing video counts' });
    expect(screen.getByText('Failed to load the deleted and missing video counts')).toBeInTheDocument();
  });
});
