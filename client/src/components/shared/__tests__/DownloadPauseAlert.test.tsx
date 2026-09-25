import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { DownloadPauseAlert, STORAGE_LIMITS_SETTINGS_PATH } from '../DownloadPauseAlert';
import { DownloadPauseStatus } from '../../../types/downloadPause';

const pausedStatus: DownloadPauseStatus = {
  paused: true,
  pausedSince: '2026-09-24T01:00:00.000Z',
  reasons: [
    { type: 'usage', currentBytes: 2, limitBytes: 1, text: 'downloaded videos use 512.0 GB, over the 500 GB limit' },
    { type: 'freeSpace', currentBytes: 1, limitBytes: 2, text: 'only 12.0 GB of disk space is free, below the 50 GB minimum' },
  ],
  usage: { limit: '500GB', limitBytes: 1, downloadedBytes: 2 },
  freeSpace: { limit: '50GB', limitBytes: 2, availableBytes: 1 },
  checkedAt: '2026-09-24T01:00:00.000Z',
};

const renderAlert = (props: Partial<React.ComponentProps<typeof DownloadPauseAlert>> = {}) =>
  render(
    <MemoryRouter>
      <DownloadPauseAlert status={pausedStatus} {...props} />
    </MemoryRouter>
  );

describe('DownloadPauseAlert', () => {
  test('explains that downloads are paused', () => {
    renderAlert();

    expect(screen.getByText('Downloads are paused')).toBeInTheDocument();
  });

  test('lists every reason as a sentence', () => {
    renderAlert();

    expect(screen.getByText('Downloaded videos use 512.0 GB, over the 500 GB limit.')).toBeInTheDocument();
    expect(screen.getByText('Only 12.0 GB of disk space is free, below the 50 GB minimum.')).toBeInTheDocument();
  });

  test('links to the storage limit settings', () => {
    renderAlert();

    expect(screen.getByRole('link', { name: 'Storage limit settings' })).toHaveAttribute(
      'href',
      STORAGE_LIMITS_SETTINGS_PATH
    );
  });

  test('omits the settings link when asked to', () => {
    renderAlert({ hideSettingsLink: true });

    expect(screen.queryByRole('link', { name: 'Storage limit settings' })).not.toBeInTheDocument();
  });

  test('renders nothing while downloads are not paused', () => {
    renderAlert({ status: { ...pausedStatus, paused: false, reasons: [] } });

    expect(screen.queryByTestId('download-pause-alert')).not.toBeInTheDocument();
  });

  test('offers a close button only when dismissible', async () => {
    const onDismiss = jest.fn();
    renderAlert({ onDismiss });

    await userEvent.click(screen.getByRole('button'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('has no close button when not dismissible', () => {
    renderAlert();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
