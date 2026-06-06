import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MaintenanceSection } from '../MaintenanceSection';
import { UseRescanStatusReturn, RescanLastRun } from '../../../hooks/useRescanStatus';

jest.mock('../../../hooks/useRescanStatus', () => ({
  useRescanStatus: jest.fn()
}));

const { useRescanStatus } = require('../../../hooks/useRescanStatus') as {
  useRescanStatus: jest.Mock<UseRescanStatusReturn, [string | null]>;
};

function setup(overrides: Partial<UseRescanStatusReturn> = {}) {
  const triggerRescan = jest.fn().mockResolvedValue(undefined);
  useRescanStatus.mockReturnValue({
    running: false,
    lastRun: null,
    loading: false,
    error: null,
    triggerRescan,
    ...overrides
  });
  render(<MaintenanceSection token="tok" />);
  return { triggerRescan };
}

describe('MaintenanceSection', () => {
  beforeEach(() => jest.clearAllMocks());

  test('renders idle with no prior run', () => {
    setup();
    expect(screen.getByRole('button', { name: /rescan files on disk/i })).toBeEnabled();
    expect(screen.getByText(/no rescan has run yet/i)).toBeInTheDocument();
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
