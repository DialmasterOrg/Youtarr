import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { DownloadPauseBanner, DISMISSED_PAUSE_STORAGE_KEY } from '../DownloadPauseBanner';
import { DownloadPauseStatus } from '../../../types/downloadPause';

jest.mock('../../../hooks/useDownloadPauseStatus', () => ({
  useDownloadPauseStatus: jest.fn(),
}));

const { useDownloadPauseStatus } = require('../../../hooks/useDownloadPauseStatus');

const makeStatus = (overrides: Partial<DownloadPauseStatus> = {}): DownloadPauseStatus => ({
  paused: true,
  pausedSince: '2026-09-24T01:00:00.000Z',
  reasons: [{ type: 'usage', currentBytes: 2, limitBytes: 1, text: 'downloaded videos use 2 B, over the 1 B limit' }],
  usage: { limit: '1GB', limitBytes: 1, downloadedBytes: 2 },
  freeSpace: { limit: null, limitBytes: null, availableBytes: null },
  checkedAt: '2026-09-24T01:00:00.000Z',
  ...overrides,
});

const mockStatus = (data: DownloadPauseStatus | null) => {
  useDownloadPauseStatus.mockReturnValue({ data, loading: false, error: null, refresh: jest.fn() });
};

const renderBanner = (path = '/videos') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <DownloadPauseBanner token="token-1" />
    </MemoryRouter>
  );

describe('DownloadPauseBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('shows the pause alert while downloads are paused', () => {
    mockStatus(makeStatus());

    renderBanner();

    expect(screen.getByTestId('download-pause-alert')).toBeInTheDocument();
  });

  test('renders nothing while downloads are running', () => {
    mockStatus(makeStatus({ paused: false, pausedSince: null, reasons: [] }));

    renderBanner();

    expect(screen.queryByTestId('download-pause-alert')).not.toBeInTheDocument();
  });

  test('renders nothing before the status loads', () => {
    mockStatus(null);

    renderBanner();

    expect(screen.queryByTestId('download-pause-alert')).not.toBeInTheDocument();
  });

  test('hides after being dismissed', async () => {
    mockStatus(makeStatus());
    renderBanner();

    await userEvent.click(screen.getByRole('button'));

    expect(screen.queryByTestId('download-pause-alert')).not.toBeInTheDocument();
  });

  test('stays hidden for a pause the user already dismissed', () => {
    localStorage.setItem(DISMISSED_PAUSE_STORAGE_KEY, '2026-09-24T01:00:00.000Z');
    mockStatus(makeStatus());

    renderBanner();

    expect(screen.queryByTestId('download-pause-alert')).not.toBeInTheDocument();
  });

  test('always shows on the download pages, even after being dismissed', () => {
    localStorage.setItem(DISMISSED_PAUSE_STORAGE_KEY, '2026-09-24T01:00:00.000Z');
    mockStatus(makeStatus());

    renderBanner('/downloads/activity');

    expect(screen.getByTestId('download-pause-alert')).toBeInTheDocument();
  });

  test('cannot be dismissed on the download pages', () => {
    mockStatus(makeStatus());

    renderBanner('/downloads/manual');

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('stays hidden on the Storage Limits page, which shows its own alert', () => {
    mockStatus(makeStatus());

    renderBanner('/settings/storage-limits');

    expect(screen.queryByTestId('download-pause-alert')).not.toBeInTheDocument();
  });

  test('shows again for a new pause after an earlier one was dismissed', () => {
    localStorage.setItem(DISMISSED_PAUSE_STORAGE_KEY, '2026-09-20T00:00:00.000Z');
    mockStatus(makeStatus());

    renderBanner();

    expect(screen.getByTestId('download-pause-alert')).toBeInTheDocument();
  });
});
