import { renderWithProviders } from '../../../test-utils';
import { DEFAULT_CONFIG } from '../../../config/configSchema';
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MaintenanceSection } from '../MaintenanceSection';
import { UseRescanStatusReturn, RescanLastRun } from '../../../hooks/useRescanStatus';
import type { RemovedVideosLibraryCheck } from '../hooks/useRemovedVideos';

jest.mock('../../../hooks/useRescanStatus', () => ({
  useRescanStatus: jest.fn()
}));

jest.mock('../hooks/useRemovedVideos', () => ({
  useRemovedVideos: jest.fn()
}));

const { useRescanStatus } = require('../../../hooks/useRescanStatus') as {
  useRescanStatus: jest.Mock<UseRescanStatusReturn, [string | null]>;
};
const { useRemovedVideos } = require('../hooks/useRemovedVideos') as {
  useRemovedVideos: jest.Mock;
};

function setup(
  overrides: Partial<UseRescanStatusReturn> = {},
  libraryCheck: RemovedVideosLibraryCheck = { ok: true, reason: null, path: null, message: null },
  route = '/settings/maintenance'
) {
  const triggerRescan = jest.fn().mockResolvedValue({ started: true });
  useRescanStatus.mockReturnValue({
    running: false,
    lastRun: null,
    loading: false,
    error: null,
    triggerRescan,
    ...overrides
  });
  useRemovedVideos.mockReturnValue({
    summary: { deleted: 2, missing: 1, legacy: 0, libraryCheck },
    loading: false,
    error: null,
    refetch: jest.fn(),
    markAllMissingDeleted: jest.fn(),
    emptyTrash: jest.fn(),
    actionPending: false,
    actionError: null,
  });
  renderWithProviders(<MaintenanceSection token="tok" config={DEFAULT_CONFIG} />, { initialEntries: [route] });
  return { triggerRescan };
}

describe('MaintenanceSection', () => {
  beforeEach(() => jest.clearAllMocks());

  test('renders idle with no prior run', () => {
    setup();
    expect(screen.getByRole('button', { name: /rescan files on disk/i })).toBeEnabled();
    expect(screen.getByText(/no rescan has run yet/i)).toBeInTheDocument();
  });

  test('hosts the deleted and missing videos card below the rescan card', () => {
    setup();
    expect(screen.getByText('Deleted and missing videos')).toBeInTheDocument();
    expect(screen.getByText('Deleted: 2. Missing: 1.')).toBeInTheDocument();
  });

  describe('linked from the Videos page', () => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
    let scrolledTo: Element[];

    beforeEach(() => {
      scrolledTo = [];
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        writable: true,
        value: function scrollIntoView(this: Element) {
          scrolledTo.push(this);
        },
      });
    });

    afterEach(() => {
      if (original) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', original);
      } else {
        delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
      }
    });

    test('scrolls to the deleted and missing videos card', () => {
      setup({}, undefined, '/settings/maintenance#deleted-and-missing');
      expect(scrolledTo).toEqual([screen.getByRole('region', { name: 'Deleted and missing videos' })]);
    });

    test('stays at the top of the page without the link', () => {
      setup();
      expect(scrolledTo).toEqual([]);
    });
  });

  test('wires Rescan anyway to a rescan that skips the downloads folder check', async () => {
    const user = userEvent.setup();
    const { triggerRescan } = setup({}, { ok: false, reason: 'empty', path: '/d', message: 'The downloads folder is empty.' });

    await user.click(screen.getByRole('button', { name: 'Rescan anyway...' }));
    await user.click(screen.getByRole('button', { name: 'Rescan anyway' }));

    expect(triggerRescan).toHaveBeenCalledWith({ ignoreLibraryCheck: true });
  });

  test('renders idle with last-run summary', () => {
    const lastRun: RescanLastRun = {
      startedAt: '2026-05-04T15:00:00.000Z',
      completedAt: '2026-05-04T15:01:00.000Z',
      trigger: 'manual',
      status: 'completed',
      videosUpdated: 7,
      videosMarkedMissing: 2,
      videosScanned: 100,
      filesFoundOnDisk: 98,
      errorMessage: null
    };
    setup({ lastRun });
    expect(screen.getByText(/updated 7 videos/i)).toBeInTheDocument();
    expect(screen.getByText(/marked 2 missing/i)).toBeInTheDocument();
  });

  test('says when the last rescan skipped the downloads folder check', () => {
    const lastRun: RescanLastRun = {
      startedAt: '2026-05-04T15:00:00.000Z',
      completedAt: '2026-05-04T15:01:00.000Z',
      trigger: 'manual',
      status: 'completed',
      videosUpdated: 0,
      videosMarkedMissing: 3,
      videosScanned: 100,
      filesFoundOnDisk: 97,
      errorMessage: null,
      libraryCheckSkipped: true
    };
    setup({ lastRun });
    expect(screen.getByText(/The downloads folder check was skipped\./)).toBeInTheDocument();
  });

  test('disables button while running', () => {
    setup({ running: true });
    expect(screen.getByRole('button', { name: /rescan files on disk/i })).toBeDisabled();
    expect(screen.getByText(/rescan in progress/i)).toBeInTheDocument();
  });

  test('disables button while loading initial status', () => {
    setup({ loading: true });
    expect(screen.getByRole('button', { name: /rescan files on disk/i })).toBeDisabled();
  });

  test('clicking button calls triggerRescan', async () => {
    const { triggerRescan } = setup();
    await userEvent.click(screen.getByRole('button', { name: /rescan files on disk/i }));
    await waitFor(() => expect(triggerRescan).toHaveBeenCalledTimes(1));
  });

  test('displays error string when error is set', () => {
    setup({ error: 'Rescan already in progress' });
    expect(screen.getByText(/rescan already in progress/i)).toBeInTheDocument();
  });

  test('displays errorMessage from a prior errored run', () => {
    const lastRun: RescanLastRun = {
      startedAt: '2026-05-04T15:00:00.000Z',
      completedAt: '2026-05-04T15:01:00.000Z',
      trigger: 'manual',
      status: 'error',
      videosUpdated: 0,
      videosMarkedMissing: 0,
      videosScanned: 0,
      filesFoundOnDisk: 0,
      errorMessage: 'Permission denied scanning /videos'
    };
    setup({ lastRun });
    expect(screen.getByText(/permission denied scanning/i)).toBeInTheDocument();
  });
});
