import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { WatchStatusSyncState } from '../../hooks/useWatchStatusSync';

// Both data sources are hooks with their own test coverage; mock them with
// mutable return objects (same pattern as VideoModal's hook mocks) so each
// test can shape server status and sync state directly.
const mediaServerStatusReturn = {
  status: { plex: true, jellyfin: false, emby: false },
  anyConfigured: true,
  loading: false,
  error: null as string | null,
  refetch: jest.fn(),
};
jest.mock('../../../../hooks/useMediaServerStatus', () => ({
  useMediaServerStatus: () => mediaServerStatusReturn,
}));

const mockStartSync = jest.fn();
const watchStatusSyncReturn = {
  syncState: null as WatchStatusSyncState | null,
  running: false,
  starting: false,
  startError: null as string | null,
  pollError: null as string | null,
  get startSync() { return mockStartSync; },
  refresh: jest.fn(),
};
jest.mock('../../hooks/useWatchStatusSync', () => ({
  useWatchStatusSync: () => watchStatusSyncReturn,
}));

import WatchStatusSection from '../WatchStatusSection';
import { renderWithProviders } from '../../../../test-utils';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';

describe('WatchStatusSection', () => {
  const defaultProps = {
    config: { ...DEFAULT_CONFIG },
    token: 'tok',
    onConfigChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mediaServerStatusReturn.status = { plex: true, jellyfin: false, emby: false };
    mediaServerStatusReturn.anyConfigured = true;
    mediaServerStatusReturn.loading = false;
    mediaServerStatusReturn.error = null;
    watchStatusSyncReturn.syncState = null;
    watchStatusSyncReturn.running = false;
    watchStatusSyncReturn.starting = false;
    watchStatusSyncReturn.startError = null;
    watchStatusSyncReturn.pollError = null;
  });

  test('toggling the switch updates watchStatusSyncEnabled', async () => {
    renderWithProviders(<WatchStatusSection {...defaultProps} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /enable watch status sync/i }));
    expect(defaultProps.onConfigChange).toHaveBeenCalledWith({ watchStatusSyncEnabled: false });
  });

  test('shows which servers are connected', () => {
    renderWithProviders(<WatchStatusSection {...defaultProps} />);
    expect(screen.getByText(/Syncing watch status from: Plex/)).toBeInTheDocument();
  });

  test('warns when no media server is connected', () => {
    mediaServerStatusReturn.status = { plex: false, jellyfin: false, emby: false };
    mediaServerStatusReturn.anyConfigured = false;
    renderWithProviders(<WatchStatusSection {...defaultProps} />);
    expect(screen.getByText(/no media servers connected/i)).toBeInTheDocument();
  });

  test('does not claim "no servers" while the status is still loading', () => {
    mediaServerStatusReturn.status = { plex: false, jellyfin: false, emby: false };
    mediaServerStatusReturn.anyConfigured = false;
    mediaServerStatusReturn.loading = true;
    renderWithProviders(<WatchStatusSection {...defaultProps} />);
    expect(screen.queryByText(/no media servers connected/i)).not.toBeInTheDocument();
  });

  test('shows an error instead of "no servers" when the status fetch failed', () => {
    mediaServerStatusReturn.status = { plex: false, jellyfin: false, emby: false };
    mediaServerStatusReturn.anyConfigured = false;
    mediaServerStatusReturn.error = 'Failed to load media server status';
    renderWithProviders(<WatchStatusSection {...defaultProps} />);
    expect(screen.getByText(/could not check connected media servers/i)).toBeInTheDocument();
    expect(screen.queryByText(/no media servers connected/i)).not.toBeInTheDocument();
  });

  test('suppresses the connected-servers alert while the status check is failing', () => {
    // useMediaServerStatus retains the last successful status when a later
    // poll fails; the stale success alert must not contradict the warning.
    mediaServerStatusReturn.error = 'Failed to load media server status';
    renderWithProviders(<WatchStatusSection {...defaultProps} />);
    expect(screen.getByText(/could not check connected media servers/i)).toBeInTheDocument();
    expect(screen.queryByText(/syncing watch status from/i)).not.toBeInTheDocument();
  });

  test('Sync Now triggers the sync', async () => {
    renderWithProviders(<WatchStatusSection {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /sync now/i }));
    expect(mockStartSync).toHaveBeenCalledTimes(1);
  });

  test('Sync Now is disabled when no servers are connected', () => {
    mediaServerStatusReturn.status = { plex: false, jellyfin: false, emby: false };
    mediaServerStatusReturn.anyConfigured = false;
    renderWithProviders(<WatchStatusSection {...defaultProps} />);
    expect(screen.getByRole('button', { name: /sync now/i })).toBeDisabled();
  });

  test('shows an in-progress button while a sync is running', () => {
    watchStatusSyncReturn.syncState = { running: true, lastRun: null };
    watchStatusSyncReturn.running = true;
    renderWithProviders(<WatchStatusSection {...defaultProps} />);
    expect(screen.getByRole('button', { name: /sync in progress/i })).toBeDisabled();
  });

  test('re-enables Sync Now and warns when the sync status cannot be checked', () => {
    // The hook reports running=false once its poll-failure ceiling trips,
    // even though the server may still be mid-sync.
    watchStatusSyncReturn.syncState = { running: true, lastRun: null };
    watchStatusSyncReturn.running = false;
    watchStatusSyncReturn.pollError =
      'Could not check sync status; it may still be running on the server.';
    renderWithProviders(<WatchStatusSection {...defaultProps} />);
    expect(screen.getByRole('button', { name: /sync now/i })).toBeEnabled();
    expect(screen.getByText(/could not check sync status/i)).toBeInTheDocument();
  });

  test('surfaces the start error message', () => {
    watchStatusSyncReturn.startError = 'Watch status sync is already running';
    renderWithProviders(<WatchStatusSection {...defaultProps} />);
    expect(screen.getByText(/watch status sync is already running/i)).toBeInTheDocument();
  });

  test('shows the last run summary with per-server results', () => {
    watchStatusSyncReturn.syncState = {
      running: false,
      lastRun: {
        trigger: 'manual',
        startedAt: '2026-07-16T09:58:00Z',
        completedAt: '2026-07-16T10:00:00Z',
        servers: {
          plex: { updated: 12 },
          jellyfin: { error: 'server not reachable or not responding' },
        },
      },
    };
    renderWithProviders(<WatchStatusSection {...defaultProps} />);
    expect(screen.getByText(/last sync/i)).toBeInTheDocument();
    expect(screen.getByText(/Plex: 12 videos updated/)).toBeInTheDocument();
    expect(screen.getByText(/Jellyfin: failed \(server not reachable or not responding\)/)).toBeInTheDocument();
  });

  test('shows a skipped last run', () => {
    watchStatusSyncReturn.syncState = {
      running: false,
      lastRun: {
        trigger: 'scheduled',
        startedAt: '2026-07-16T09:58:00Z',
        completedAt: '2026-07-16T09:58:01Z',
        skipped: 'no media servers configured',
      },
    };
    renderWithProviders(<WatchStatusSection {...defaultProps} />);
    expect(screen.getByText(/skipped, no media servers configured/i)).toBeInTheDocument();
  });

  test('shows the current frequency and reports the mapped cron when changed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WatchStatusSection {...defaultProps} />);

    const selectButton = screen.getByRole('button', { name: /every 4 hours/i });
    await user.click(selectButton);

    const dailyOption = await screen.findByRole('option', { name: 'Daily' });
    await user.click(dailyOption);

    expect(defaultProps.onConfigChange).toHaveBeenCalledWith({ watchStatusSyncFrequency: '0 0 * * *' });
  });

  test('does not offer sub-hourly frequencies', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WatchStatusSection {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /every 4 hours/i }));
    await screen.findByRole('option', { name: 'Daily' });

    expect(screen.queryByRole('option', { name: 'Every 15 minutes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Every 30 minutes' })).not.toBeInTheDocument();
  });

  test('still renders a saved sub-hourly frequency as the current selection', () => {
    const config = { ...DEFAULT_CONFIG, watchStatusSyncFrequency: '*/15 * * * *' };
    renderWithProviders(<WatchStatusSection {...defaultProps} config={config} />);
    expect(screen.getByRole('button', { name: /every 15 minutes/i })).toBeInTheDocument();
  });
});
