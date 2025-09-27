import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DownloadNew from '../DownloadNew';

const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock('../ManualDownload/ManualDownload', () => ({
  __esModule: true,
  default: function MockManualDownload({ onStartDownload, token, defaultResolution }: any) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'manual-download' },
      React.createElement('span', null, `Resolution: ${defaultResolution}`),
      React.createElement('button', {
        onClick: () => onStartDownload(['https://youtube.com/watch?v=test'], { resolution: '1080' }),
        'data-testid': 'trigger-manual-download'
      }, 'Start Manual Download'),
      React.createElement('button', {
        onClick: () => onStartDownload(['https://youtube.com/watch?v=test&list=123'], null),
        'data-testid': 'trigger-manual-with-ampersand'
      }, 'Download URL with ampersand')
    );
  }
}));

jest.mock('../ManualDownload/DownloadSettingsDialog', () => ({
  __esModule: true,
  default: function MockDownloadSettingsDialog({ open, onClose, onConfirm, defaultResolution, defaultVideoCount, mode }: any) {
    const React = require('react');
    if (!open) return null;
    return React.createElement('div', { 'data-testid': 'download-settings-dialog' },
      React.createElement('span', null, `Resolution: ${defaultResolution}`),
      React.createElement('span', null, `Video Count: ${defaultVideoCount}`),
      React.createElement('span', null, `Mode: ${mode}`),
      React.createElement('button', {
        onClick: () => onConfirm({ resolution: '720', videoCount: 5 }),
        'data-testid': 'confirm-with-settings'
      }, 'Confirm With Settings'),
      React.createElement('button', {
        onClick: () => onConfirm(null),
        'data-testid': 'confirm-default'
      }, 'Confirm Default'),
      React.createElement('button', {
        onClick: onClose,
        'data-testid': 'cancel-dialog'
      }, 'Cancel')
    );
  }
}));

jest.mock('../../ErrorBoundary', () => ({
  __esModule: true,
  default: function MockErrorBoundary({ children }: any) {
    return children;
  }
}));

describe('DownloadNew', () => {
  const mockSetVideoUrls = jest.fn();
  const mockFetchRunningJobs = jest.fn();
  const mockDownloadInitiatedRef = { current: false };
  const mockToken = 'test-token';

  const defaultProps = {
    videoUrls: '',
    setVideoUrls: mockSetVideoUrls,
    token: mockToken,
    fetchRunningJobs: mockFetchRunningJobs,
    downloadInitiatedRef: mockDownloadInitiatedRef,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDownloadInitiatedRef.current = false;
    jest.useFakeTimers();
    // Default mock for fetch to handle config requests
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        preferredResolution: '1080',
        channelFilesToDownload: 3,
      }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders with initial tab showing manual download', () => {
    render(<DownloadNew {...defaultProps} />);

    expect(screen.getByText('Start Downloads')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Manual Download' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Channel Download' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('manual-download')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download new from all channels' })).not.toBeInTheDocument();
  });

  test('switches between tabs correctly', async () => {
    const user = userEvent.setup({ delay: null });
    render(<DownloadNew {...defaultProps} />);

    const channelTab = screen.getByRole('tab', { name: 'Channel Download' });
    await user.click(channelTab);

    expect(channelTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Manual Download' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByTestId('manual-download')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download new from all channels' })).toBeInTheDocument();

    const manualTab = screen.getByRole('tab', { name: 'Manual Download' });
    await user.click(manualTab);

    expect(manualTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('manual-download')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download new from all channels' })).not.toBeInTheDocument();
  });

  test('fetches config on mount and sets default values', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        preferredResolution: '720',
        channelFilesToDownload: 10,
      }),
    });

    render(<DownloadNew {...defaultProps} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/getconfig', {
        headers: { 'x-access-token': mockToken },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Resolution: 720')).toBeInTheDocument();
    });
  });

  test('handles config fetch error gracefully', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<DownloadNew {...defaultProps} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/getconfig', {
        headers: { 'x-access-token': mockToken },
      });
    });

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Error fetching config:', expect.any(Error));
    });

    expect(screen.getByText('Resolution: 1080')).toBeInTheDocument();

    consoleError.mockRestore();
  });

  test('does not fetch config when token is null', () => {
    render(<DownloadNew {...defaultProps} token={null} />);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('opens channel settings dialog when button is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    render(<DownloadNew {...defaultProps} />);

    const channelTab = screen.getByRole('tab', { name: 'Channel Download' });
    await user.click(channelTab);

    const downloadButton = screen.getByRole('button', { name: 'Download new from all channels' });
    await user.click(downloadButton);

    expect(screen.getByTestId('download-settings-dialog')).toBeInTheDocument();
    expect(screen.getByText('Mode: channel')).toBeInTheDocument();
    expect(screen.getByText('Resolution: 1080')).toBeInTheDocument();
    expect(screen.getByText('Video Count: 3')).toBeInTheDocument();
  });

  test('triggers channel downloads with custom settings', async () => {
    const user = userEvent.setup({ delay: null });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValueOnce({}),
    });

    render(<DownloadNew {...defaultProps} />);

    const channelTab = screen.getByRole('tab', { name: 'Channel Download' });
    await user.click(channelTab);

    const downloadButton = screen.getByRole('button', { name: 'Download new from all channels' });
    await user.click(downloadButton);

    const confirmButton = screen.getByTestId('confirm-with-settings');
    await user.click(confirmButton);

    expect(mockFetch).toHaveBeenCalledWith('/triggerchanneldownloads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': mockToken,
      },
      body: JSON.stringify({
        overrideSettings: { resolution: '720', videoCount: 5 }
      }),
    });

    expect(mockDownloadInitiatedRef.current).toBe(true);
    expect(screen.queryByTestId('download-settings-dialog')).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockFetchRunningJobs).toHaveBeenCalled();
  });

  test('triggers channel downloads with default settings', async () => {
    const user = userEvent.setup({ delay: null });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValueOnce({}),
    });

    render(<DownloadNew {...defaultProps} />);

    const channelTab = screen.getByRole('tab', { name: 'Channel Download' });
    await user.click(channelTab);

    const downloadButton = screen.getByRole('button', { name: 'Download new from all channels' });
    await user.click(downloadButton);

    const confirmButton = screen.getByTestId('confirm-default');
    await user.click(confirmButton);

    expect(mockFetch).toHaveBeenCalledWith('/triggerchanneldownloads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': mockToken,
      },
      body: JSON.stringify({}),
    });

    expect(mockDownloadInitiatedRef.current).toBe(true);
  });

  test('shows alert when channel download already running', async () => {
    const user = userEvent.setup({ delay: null });
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        preferredResolution: '1080',
        channelFilesToDownload: 3,
      }),
    }).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValueOnce({}),
    });

    render(<DownloadNew {...defaultProps} />);

    const channelTab = screen.getByRole('tab', { name: 'Channel Download' });
    await user.click(channelTab);

    const downloadButton = screen.getByRole('button', { name: 'Download new from all channels' });
    await user.click(downloadButton);

    const confirmButton = screen.getByTestId('confirm-default');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Channel Download already running');
    });

    expect(mockDownloadInitiatedRef.current).toBe(true);

    alertSpy.mockRestore();
  });

  test('cancels channel settings dialog', async () => {
    const user = userEvent.setup({ delay: null });
    render(<DownloadNew {...defaultProps} />);

    const channelTab = screen.getByRole('tab', { name: 'Channel Download' });
    await user.click(channelTab);

    const downloadButton = screen.getByRole('button', { name: 'Download new from all channels' });
    await user.click(downloadButton);

    expect(screen.getByTestId('download-settings-dialog')).toBeInTheDocument();

    const cancelButton = screen.getByTestId('cancel-dialog');
    await user.click(cancelButton);

    expect(screen.queryByTestId('download-settings-dialog')).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalledWith('/triggerchanneldownloads', expect.any(Object));
    expect(mockDownloadInitiatedRef.current).toBe(false);
  });

  test('handles manual download callback', async () => {
    const user = userEvent.setup({ delay: null });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValueOnce({}),
    });

    render(<DownloadNew {...defaultProps} />);

    const triggerButton = screen.getByTestId('trigger-manual-download');
    await user.click(triggerButton);

    expect(mockFetch).toHaveBeenCalledWith('/triggerspecificdownloads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': mockToken,
      },
      body: JSON.stringify({
        urls: ['https://youtube.com/watch?v=test'],
        overrideSettings: { resolution: '1080' }
      }),
    });

    expect(mockDownloadInitiatedRef.current).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockFetchRunningJobs).toHaveBeenCalled();
  });

  test('strips URLs with ampersands in manual download', async () => {
    const user = userEvent.setup({ delay: null });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValueOnce({}),
    });

    render(<DownloadNew {...defaultProps} />);

    const triggerButton = screen.getByTestId('trigger-manual-with-ampersand');
    await user.click(triggerButton);

    expect(mockFetch).toHaveBeenCalledWith('/triggerspecificdownloads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': mockToken,
      },
      body: JSON.stringify({
        urls: ['https://youtube.com/watch?v=test']
      }),
    });
  });

  test('handles null token in requests', async () => {
    const user = userEvent.setup({ delay: null });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValueOnce({}),
    });

    render(<DownloadNew {...defaultProps} token={null} />);

    const channelTab = screen.getByRole('tab', { name: 'Channel Download' });
    await user.click(channelTab);

    const downloadButton = screen.getByRole('button', { name: 'Download new from all channels' });
    await user.click(downloadButton);

    const confirmButton = screen.getByTestId('confirm-default');
    await user.click(confirmButton);

    expect(mockFetch).toHaveBeenCalledWith('/triggerchanneldownloads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': '',
      },
      body: JSON.stringify({}),
    });
  });

  test('updates default resolution from fetched config', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        preferredResolution: '4K',
        channelFilesToDownload: 15,
      }),
    });

    const user = userEvent.setup({ delay: null });
    render(<DownloadNew {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Resolution: 4K')).toBeInTheDocument();
    });

    const channelTab = screen.getByRole('tab', { name: 'Channel Download' });
    await user.click(channelTab);

    const downloadButton = screen.getByRole('button', { name: 'Download new from all channels' });
    await user.click(downloadButton);

    expect(screen.getByText('Resolution: 4K')).toBeInTheDocument();
    expect(screen.getByText('Video Count: 15')).toBeInTheDocument();
  });

  test('maintains tab state across re-renders', async () => {
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(<DownloadNew {...defaultProps} />);

    const channelTab = screen.getByRole('tab', { name: 'Channel Download' });
    await user.click(channelTab);

    expect(screen.getByRole('button', { name: 'Download new from all channels' })).toBeInTheDocument();

    rerender(<DownloadNew {...defaultProps} videoUrls="updated" />);

    expect(channelTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Download new from all channels' })).toBeInTheDocument();
  });

  test('handles partial config response', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        preferredResolution: '480',
      }),
    });

    render(<DownloadNew {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Resolution: 480')).toBeInTheDocument();
    });

    const user = userEvent.setup({ delay: null });
    const channelTab = screen.getByRole('tab', { name: 'Channel Download' });
    await user.click(channelTab);

    const downloadButton = screen.getByRole('button', { name: 'Download new from all channels' });
    await user.click(downloadButton);

    expect(screen.getByText('Resolution: 480')).toBeInTheDocument();
    expect(screen.getByText('Video Count: 3')).toBeInTheDocument();
  });
});