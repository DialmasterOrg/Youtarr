import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DownloadAllVideosDialog from '../DownloadAllVideosDialog';
import type { DownloadAllPreview } from '../hooks/useChannelDownloadAll';

const mockFetchPreview = jest.fn();
const mockStartDownloadAll = jest.fn();
const mockResetPreview = jest.fn();
const mockHookState: {
  preview: DownloadAllPreview | null;
  error: string | null;
  starting: boolean;
} = {
  preview: null,
  error: null,
  starting: false,
};

jest.mock('../hooks/useChannelDownloadAll', () => ({
  useChannelDownloadAll: () => ({
    preview: mockHookState.preview,
    previewLoading: false,
    starting: mockHookState.starting,
    error: mockHookState.error,
    fetchPreview: mockFetchPreview,
    startDownloadAll: mockStartDownloadAll,
    resetPreview: mockResetPreview,
  }),
}));

jest.mock('../../DownloadManager/ManualDownload/DownloadSettingsDialog', () => ({
  __esModule: true,
  default: function MockDownloadSettingsDialog(props: {
    open: boolean;
    videoCount?: number;
    hideRedownloadOption?: boolean;
    onConfirm: (settings: unknown) => void;
  }) {
    const ReactLib = require('react');
    if (!props.open) return null;
    return ReactLib.createElement(
      'div',
      {
        'data-testid': 'download-settings-dialog',
        'data-hide-redownload': String(props.hideRedownloadOption),
      },
      ReactLib.createElement('span', null, `settings-count:${props.videoCount}`),
      ReactLib.createElement(
        'button',
        {
          // Includes allowRedownload to prove the dialog's mapping drops it.
          onClick: () =>
            props.onConfirm({
              resolution: '720',
              allowRedownload: true,
              subfolder: null,
              audioFormat: null,
              rating: null,
              skipVideoFolder: false,
            }),
        },
        'Mock Confirm Settings'
      )
    );
  },
}));

const PREVIEW: DownloadAllPreview = {
  count: 42,
  totalDurationSeconds: 3600,
  missingDurations: 2,
};

const baseProps = {
  open: true,
  onClose: jest.fn(),
  channelId: 'UC123',
  token: 'token-1',
  tabType: 'videos',
  tabLabel: 'Videos',
  defaultResolution: '1080',
  defaultResolutionSource: 'global' as const,
  onStarted: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockHookState.preview = null;
  mockHookState.error = null;
  mockHookState.starting = false;
  mockFetchPreview.mockResolvedValue(PREVIEW);
  mockStartDownloadAll.mockResolvedValue(42);
});

describe('DownloadAllVideosDialog', () => {
  test('shows the loading state while channel metadata is being fetched', async () => {
    const runMetadataFetch = jest.fn(() => new Promise(() => {}));

    render(<DownloadAllVideosDialog {...baseProps} runMetadataFetch={runMetadataFetch} />);

    expect(
      await screen.findByText(/Loading metadata for all channel videos/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    expect(runMetadataFetch).toHaveBeenCalledTimes(1);
  });

  test('shows the count, content duration, and queue warning once prepared', async () => {
    mockHookState.preview = PREVIEW;
    const runMetadataFetch = jest.fn().mockResolvedValue({});

    render(<DownloadAllVideosDialog {...baseProps} runMetadataFetch={runMetadataFetch} />);

    expect(
      await screen.findByText(/about to download 42 videos/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/at least 1 hour of content/i)).toBeInTheDocument();
    expect(
      screen.getByText(/all other downloads .* will wait/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/videos already downloaded are kept/i)).toBeInTheDocument();
    expect(
      screen.getByText(/previously downloaded videos .* are not included/i)
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
    });
    expect(mockFetchPreview).toHaveBeenCalledWith('videos');
  });

  test('disables Continue and explains when there is nothing to download', async () => {
    mockHookState.preview = { count: 0, totalDurationSeconds: 0, missingDurations: 0 };
    const runMetadataFetch = jest.fn().mockResolvedValue({});

    render(<DownloadAllVideosDialog {...baseProps} runMetadataFetch={runMetadataFetch} />);

    expect(
      await screen.findByText(/already been downloaded/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  test('warns but still allows continuing when the metadata refresh fails', async () => {
    mockHookState.preview = PREVIEW;
    const runMetadataFetch = jest.fn().mockResolvedValue(null);

    render(<DownloadAllVideosDialog {...baseProps} runMetadataFetch={runMetadataFetch} />);

    expect(
      await screen.findByText(/count may be incomplete/i)
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
    });
  });

  test('continues to the settings step and starts the download with the chosen settings', async () => {
    mockHookState.preview = PREVIEW;
    const runMetadataFetch = jest.fn().mockResolvedValue({});
    const onStarted = jest.fn();
    const user = userEvent.setup();

    render(
      <DownloadAllVideosDialog
        {...baseProps}
        onStarted={onStarted}
        runMetadataFetch={runMetadataFetch}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: /continue/i }));

    const settingsDialog = await screen.findByTestId('download-settings-dialog');
    expect(settingsDialog).toBeInTheDocument();
    expect(settingsDialog).toHaveAttribute('data-hide-redownload', 'true');
    expect(screen.getByText('settings-count:42')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /mock confirm settings/i }));

    // allowRedownload is dropped: download-all never re-downloads.
    await waitFor(() => {
      expect(mockStartDownloadAll).toHaveBeenCalledWith('videos', {
        resolution: '720',
        subfolder: null,
        audioFormat: null,
        rating: null,
        skipVideoFolder: false,
      });
    });
    await waitFor(() => {
      expect(onStarted).toHaveBeenCalledWith(42);
    });
  });

  test('ignores repeat confirm clicks so only one download job is queued', async () => {
    mockHookState.preview = PREVIEW;
    const runMetadataFetch = jest.fn().mockResolvedValue({});
    const onStarted = jest.fn();
    const user = userEvent.setup();

    render(
      <DownloadAllVideosDialog
        {...baseProps}
        onStarted={onStarted}
        runMetadataFetch={runMetadataFetch}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: /continue/i }));

    const confirmButton = await screen.findByRole('button', {
      name: /mock confirm settings/i,
    });
    await user.click(confirmButton);
    await user.click(confirmButton);

    await waitFor(() => {
      expect(onStarted).toHaveBeenCalledTimes(1);
    });
    expect(mockStartDownloadAll).toHaveBeenCalledTimes(1);
  });

  test('allows retrying the confirm after a failed start', async () => {
    mockHookState.preview = PREVIEW;
    mockStartDownloadAll.mockResolvedValueOnce(null).mockResolvedValueOnce(42);
    const runMetadataFetch = jest.fn().mockResolvedValue({});
    const onStarted = jest.fn();
    const user = userEvent.setup();

    render(
      <DownloadAllVideosDialog
        {...baseProps}
        onStarted={onStarted}
        runMetadataFetch={runMetadataFetch}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
    });

    // First attempt fails and drops back to the confirm step.
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.click(
      await screen.findByRole('button', { name: /mock confirm settings/i })
    );
    await waitFor(() => {
      expect(mockStartDownloadAll).toHaveBeenCalledTimes(1);
    });
    expect(onStarted).not.toHaveBeenCalled();

    // Second attempt succeeds.
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.click(
      await screen.findByRole('button', { name: /mock confirm settings/i })
    );
    await waitFor(() => {
      expect(onStarted).toHaveBeenCalledWith(42);
    });
    expect(mockStartDownloadAll).toHaveBeenCalledTimes(2);
  });

  test('surfaces errors from the download-all hook', async () => {
    mockHookState.error = 'Failed to load the download preview';
    const runMetadataFetch = jest.fn().mockResolvedValue({});

    render(<DownloadAllVideosDialog {...baseProps} runMetadataFetch={runMetadataFetch} />);

    expect(
      await screen.findByText('Failed to load the download preview')
    ).toBeInTheDocument();
  });

  test('cancel closes the dialog', async () => {
    mockHookState.preview = PREVIEW;
    const runMetadataFetch = jest.fn().mockResolvedValue({});
    const onClose = jest.fn();
    const user = userEvent.setup();

    render(
      <DownloadAllVideosDialog
        {...baseProps}
        onClose={onClose}
        runMetadataFetch={runMetadataFetch}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
