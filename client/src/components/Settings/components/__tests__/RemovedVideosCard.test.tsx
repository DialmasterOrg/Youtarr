import React from 'react';
import { act, screen, waitFor } from '@testing-library/react';
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
  missingActionsBlocked: false,
  downloadsActive: false,
  ...overrides,
});

type CardProps = Partial<React.ComponentProps<typeof RemovedVideosCard>>;

const EMPTY_ROOT = { ok: false, reason: 'empty', path: '/d', message: 'The downloads folder is empty.' };
const rescanThatStarts = () => jest.fn().mockResolvedValue({ started: true });

function setup(
  summaryValue: RemovedVideosSummary | null = summary(),
  overrides: Partial<UseRemovedVideosReturn> = {},
  props: CardProps = {}
) {
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
  const view = renderWithProviders(<RemovedVideosCard token="tok" {...props} />);
  return { hook, user: userEvent.setup(), rerender: view.rerender };
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
    setup(summary({ libraryCheck: { ok: false, reason: 'missing', path: '/d', message: 'The downloads folder does not exist.' }, missingActionsBlocked: true }));
    expect(screen.getByText('The downloads folder does not exist. Until that changes, marking or emptying missing videos is disabled.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark all missing as deleted' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Empty trash...' })).toBeEnabled();
  });

  test('words the warning to fit a message that names several subfolders', () => {
    const check = { ok: false, reason: 'subfolder-empty', path: '/d/__Kids', message: 'The subfolders __Kids and __Music are empty.' };
    setup(summary({ libraryCheck: check }));
    expect(screen.getByText(
      'The subfolders __Kids and __Music are empty. Until that changes, videos stored there are not being marked missing.'
    )).toBeInTheDocument();
  });

  test('offers Rescan anyway while the downloads folder looks empty', () => {
    setup(summary({ libraryCheck: EMPTY_ROOT }), {}, { onRescanAnyway: rescanThatStarts(), rescanRunning: false });
    expect(screen.getByText(/If you removed the files yourself, rescan anyway to mark them missing\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rescan anyway...' })).toBeEnabled();
  });

  test('points to Mark all once the emptied folder\'s videos are missing', () => {
    setup(summary({ libraryCheck: EMPTY_ROOT, missingActionsBlocked: true }), {}, { onRescanAnyway: rescanThatStarts(), rescanRunning: false });
    expect(screen.getByText(/Mark all missing as deleted asks you to confirm that you removed the files yourself/)).toBeInTheDocument();
  });

  test('keeps the missing actions open, without asking, when the failing folder holds no missing videos', async () => {
    const { hook, user } = setup(summary({ libraryCheck: EMPTY_ROOT, missingActionsBlocked: false }));

    await user.click(screen.getByRole('button', { name: 'Mark all missing as deleted' }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark 4 as deleted' }));

    expect(hook.markAllMissingDeleted).toHaveBeenCalledWith({ ignoreLibraryCheck: false });
  });

  test('offers missing videos in Empty trash when the failing folder holds none of them', async () => {
    const { user } = setup(summary({ libraryCheck: EMPTY_ROOT, missingActionsBlocked: false }));
    await user.click(screen.getByRole('button', { name: 'Empty trash...' }));
    expect(screen.getByRole('radio', { name: 'Missing (4)' })).toBeEnabled();
  });

  test('disables Mark all while a rescan is running, so it cannot mark a half-scanned set', () => {
    setup(summary(), {}, { onRescanAnyway: rescanThatStarts(), rescanRunning: true });
    expect(screen.getByRole('button', { name: 'Mark all missing as deleted' })).toBeDisabled();
  });

  test('lets Mark all look past an empty folder once the user says they emptied it', async () => {
    const { hook, user } = setup(summary({ libraryCheck: EMPTY_ROOT, missingActionsBlocked: true }));

    await user.click(screen.getByRole('button', { name: 'Mark all missing as deleted' }));
    const confirm = screen.getByRole('button', { name: 'Mark 4 as deleted' });
    expect(confirm).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'I removed these files myself; they are not on an unmounted drive' }));
    await user.click(confirm);

    expect(hook.markAllMissingDeleted).toHaveBeenCalledWith({ ignoreLibraryCheck: true });
  });

  test('speaks of a single missing video in the singular', async () => {
    const { user } = setup(summary({ missing: 1 }));
    await user.click(screen.getByRole('button', { name: 'Mark all missing as deleted' }));
    expect(screen.getByText(/1 missing video will be marked as deleted.*Its record is kept, so it can still be re-downloaded/)).toBeInTheDocument();
  });

  test('does not offer Rescan anyway when the downloads folder is missing', () => {
    const missingRoot = { ok: false, reason: 'missing', path: '/d', message: 'The downloads folder does not exist.' };
    setup(summary({ libraryCheck: missingRoot }), {}, { onRescanAnyway: rescanThatStarts(), rescanRunning: false });
    expect(screen.queryByRole('button', { name: 'Rescan anyway...' })).not.toBeInTheDocument();
  });

  test('runs the rescan anyway after a confirmation that explains it', async () => {
    const onRescanAnyway = rescanThatStarts();
    const { user } = setup(summary({ libraryCheck: EMPTY_ROOT }), {}, { onRescanAnyway, rescanRunning: false });

    await user.click(screen.getByRole('button', { name: 'Rescan anyway...' }));
    expect(screen.getByText(/Only continue if you removed the files yourself/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rescan anyway' }));

    expect(onRescanAnyway).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Rescan started. When it finishes, the missing videos can be marked as deleted here.')).toBeInTheDocument();
  });

  test('says when the rescan anyway has finished, replacing the started message', async () => {
    const onRescanAnyway = rescanThatStarts();
    const { user, rerender } = setup(summary({ libraryCheck: EMPTY_ROOT }), {}, { onRescanAnyway, rescanRunning: false });
    await user.click(screen.getByRole('button', { name: 'Rescan anyway...' }));
    await user.click(screen.getByRole('button', { name: 'Rescan anyway' }));
    expect(await screen.findByText(/^Rescan started\./)).toBeInTheDocument();

    rerender(<RemovedVideosCard token="tok" onRescanAnyway={onRescanAnyway} rescanRunning />);
    rerender(<RemovedVideosCard token="tok" onRescanAnyway={onRescanAnyway} rescanRunning={false} />);

    expect(screen.getByText('Rescan finished. Videos it could not find now count as missing and can be marked as deleted.')).toBeInTheDocument();
    expect(screen.queryByText(/^Rescan started\./)).not.toBeInTheDocument();
  });

  // The rescan hook flips running on optimistically and off again on a refusal,
  // which can land before the refusal itself does.
  test('does not claim a rescan finished when it was refused after an optimistic start', async () => {
    let refuse: (outcome: { started: boolean }) => void = () => {};
    const onRescanAnyway = jest.fn(() => new Promise<{ started: boolean }>((resolve) => { refuse = resolve; }));
    const { user, rerender } = setup(summary({ libraryCheck: EMPTY_ROOT }), {}, { onRescanAnyway, rescanRunning: false });

    await user.click(screen.getByRole('button', { name: 'Rescan anyway...' }));
    await user.click(screen.getByRole('button', { name: 'Rescan anyway' }));
    rerender(<RemovedVideosCard token="tok" onRescanAnyway={onRescanAnyway} rescanRunning />);
    rerender(<RemovedVideosCard token="tok" onRescanAnyway={onRescanAnyway} rescanRunning={false} />);
    await act(async () => refuse({ started: false }));

    expect(screen.getByText('The rescan did not start. The rescan card above shows why.')).toBeInTheDocument();
    expect(screen.queryByText(/^Rescan finished\./)).not.toBeInTheDocument();
  });

  test('does not claim a rescan started when it was refused', async () => {
    const onRescanAnyway = jest.fn().mockResolvedValue({ started: false });
    const { user } = setup(summary({ libraryCheck: EMPTY_ROOT }), {}, { onRescanAnyway, rescanRunning: false });

    await user.click(screen.getByRole('button', { name: 'Rescan anyway...' }));
    await user.click(screen.getByRole('button', { name: 'Rescan anyway' }));

    expect(await screen.findByText('The rescan did not start. The rescan card above shows why.')).toBeInTheDocument();
    expect(screen.queryByText(/Rescan started\./)).not.toBeInTheDocument();
  });

  test('reloads the summary when Empty trash opens, so the download state is current', async () => {
    const { hook, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Empty trash...' }));

    expect(hook.refetch).toHaveBeenCalledTimes(1);
  });

  test('clears a stale rescan message when another action runs', async () => {
    const onRescanAnyway = jest.fn().mockResolvedValue({ started: false });
    const { user } = setup(summary({ libraryCheck: EMPTY_ROOT }), {}, { onRescanAnyway, rescanRunning: false });
    await user.click(screen.getByRole('button', { name: 'Rescan anyway...' }));
    await user.click(screen.getByRole('button', { name: 'Rescan anyway' }));
    expect(await screen.findByText('The rescan did not start. The rescan card above shows why.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Empty trash...' }));
    await user.click(screen.getByRole('checkbox', { name: 'I understand this cannot be undone' }));
    await user.click(screen.getByRole('button', { name: /^Empty trash \(/ }));

    expect(await screen.findByText(/Emptied trash:/)).toBeInTheDocument();
    expect(screen.queryByText('The rescan did not start. The rescan card above shows why.')).not.toBeInTheDocument();
  });

  test('reloads the counts when a rescan finishes', () => {
    const onRescanAnyway = rescanThatStarts();
    const { hook, rerender } = setup(summary(), {}, { onRescanAnyway, rescanRunning: true });
    expect(hook.refetch).not.toHaveBeenCalled();

    rerender(<RemovedVideosCard token="tok" onRescanAnyway={onRescanAnyway} rescanRunning={false} />);

    expect(hook.refetch).toHaveBeenCalledTimes(1);
  });

  test('disables Empty trash when only missing videos remain and the folder looks unmounted', () => {
    setup(summary({ deleted: 0, missing: 5, libraryCheck: EMPTY_ROOT, missingActionsBlocked: true }));
    expect(screen.getByRole('button', { name: 'Empty trash...' })).toBeDisabled();
  });

  test('keeps Empty trash available for missing videos alone while the folder is mounted', () => {
    setup(summary({ deleted: 0, missing: 5 }));
    expect(screen.getByRole('button', { name: 'Empty trash...' })).toBeEnabled();
  });

  test('tells the dialog when a download is running so archive removal is disabled up front', async () => {
    const { user } = setup(summary({ downloadsActive: true }));
    await user.click(screen.getByRole('button', { name: 'Empty trash...' }));
    expect(screen.getByRole('radio', { name: 'Remove them from the download archive' })).toBeDisabled();
    expect(screen.getByText('Unavailable while a download is running.')).toBeInTheDocument();
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

    expect(hook.markAllMissingDeleted).toHaveBeenCalledWith({ ignoreLibraryCheck: false });
    expect(await screen.findByText('Marked 4 videos as deleted.')).toBeInTheDocument();
  });

  test('speaks of one file when marking the only missing video', async () => {
    const { user } = setup(summary({ missing: 1 }));

    await user.click(screen.getByRole('button', { name: 'Mark all missing as deleted' }));

    expect(screen.getByText(/Only do this if the file is really gone, not sitting on an unmounted drive\./)).toBeInTheDocument();
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
