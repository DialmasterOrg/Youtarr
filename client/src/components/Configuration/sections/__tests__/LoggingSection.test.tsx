import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { LoggingSection } from '../LoggingSection';
import { renderWithProviders } from '../../../../test-utils';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';
import { LoggingStatus } from '../../types';

const mockDownloadLogs = jest.fn();
const logDownloadReturn = {
  downloading: false,
  error: null as string | null,
  get downloadLogs() { return mockDownloadLogs; },
};
jest.mock('../../hooks/useLogDownload', () => ({
  useLogDownload: () => logDownloadReturn,
}));

const STATUS: LoggingStatus = {
  envLevel: 'info',
  file: { enabled: true, directory: '/app/config/logs', maxSizeBytes: 10 * 1024 * 1024, maxFiles: 5, error: null },
};

describe('LoggingSection', () => {
  const defaultProps = {
    config: { ...DEFAULT_CONFIG },
    savedLogLevel: '' as const,
    loggingStatus: STATUS,
    token: 'tok',
    onConfigChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    logDownloadReturn.downloading = false;
    logDownloadReturn.error = null;
  });

  test('names LOG_LEVEL as the source when the setting is Default', () => {
    renderWithProviders(<LoggingSection {...defaultProps} />);

    expect(screen.getByText('Current level: info, from the LOG_LEVEL environment variable.')).toBeInTheDocument();
  });

  test('names this page as the source when a level is saved', () => {
    renderWithProviders(<LoggingSection {...defaultProps} savedLogLevel="debug" />);

    expect(screen.getByText('Current level: debug, set on this page.')).toBeInTheDocument();
  });

  test('choosing a level updates logLevel', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoggingSection {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Default (info)' }));
    await user.click(await screen.findByRole('option', { name: 'Debug' }));

    expect(defaultProps.onConfigChange).toHaveBeenCalledWith({ logLevel: 'debug' });
  });

  test('shows the log file limits', () => {
    renderWithProviders(<LoggingSection {...defaultProps} />);

    expect(screen.getByText(/A new file starts at 10MB, and the 5 most recent older files are kept\./)).toBeInTheDocument();
  });

  test('warns when log files are off', () => {
    const status = { ...STATUS, file: { ...STATUS.file, enabled: false, error: 'EACCES: permission denied' } };
    renderWithProviders(<LoggingSection {...defaultProps} loggingStatus={status} />);

    expect(screen.getByText(/Log files are off because Youtarr cannot write to its logs folder \(EACCES: permission denied\)/)).toBeInTheDocument();
  });

  test('Download logs starts the download', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoggingSection {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Download logs' }));

    expect(mockDownloadLogs).toHaveBeenCalled();
  });

  test('shows a download error', () => {
    logDownloadReturn.error = 'No log files have been written yet.';
    renderWithProviders(<LoggingSection {...defaultProps} />);

    expect(screen.getByText('No log files have been written yet.')).toBeInTheDocument();
  });
});
