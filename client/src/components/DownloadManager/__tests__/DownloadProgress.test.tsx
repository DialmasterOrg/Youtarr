import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DownloadProgress from '../DownloadProgress';
import WebSocketContext from '../../../contexts/WebSocketContext';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('DownloadProgress', () => {
  const mockSubscribe = jest.fn();
  const mockUnsubscribe = jest.fn();
  const mockDownloadProgressRef = { current: { index: null, message: '' } };
  const mockDownloadInitiatedRef = { current: false };

  const mockWebSocketContextValue = {
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    ws: {},
    isConnected: true,
  };

  const renderWithContext = (component: React.ReactElement) => {
    return render(
      <WebSocketContext.Provider value={mockWebSocketContextValue}>
        {component}
      </WebSocketContext.Provider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders with initial state showing no download activity', () => {
    renderWithContext(
      <DownloadProgress
        downloadProgressRef={mockDownloadProgressRef}
        downloadInitiatedRef={mockDownloadInitiatedRef}
      />
    );

    expect(screen.getByText('Download Progress')).toBeInTheDocument();
    expect(screen.getByText('No download activity at the moment')).toBeInTheDocument();
    expect(screen.getByText('Downloads will appear here when started')).toBeInTheDocument();
  });

  test('subscribes to WebSocket on mount and unsubscribes on unmount', () => {
    const { unmount } = renderWithContext(
      <DownloadProgress
        downloadProgressRef={mockDownloadProgressRef}
        downloadInitiatedRef={mockDownloadInitiatedRef}
      />
    );

    expect(mockSubscribe).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function)
    );

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledWith(expect.any(Function));
  });

  test('displays download progress when structured progress is received', async () => {
    renderWithContext(
      <DownloadProgress
        downloadProgressRef={mockDownloadProgressRef}
        downloadInitiatedRef={mockDownloadInitiatedRef}
      />
    );

    const [, processCallback] = mockSubscribe.mock.calls[0];

    const progressPayload = {
      progress: {
        jobId: 'test-job-1',
        progress: {
          percent: 45.5,
          downloadedBytes: 1024000,
          totalBytes: 2048000,
          speedBytesPerSecond: 512000,
          etaSeconds: 120,
        },
        stalled: false,
        state: 'downloading_video',
        videoInfo: {
          channel: 'Test Channel',
          title: 'Test Video Title',
          displayTitle: 'Test Video Title',
        },
      },
    };

    await act(async () => {
      processCallback(progressPayload);
    });

    await waitFor(() => {
      expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    });
    expect(screen.getByText('Downloading video stream...')).toBeInTheDocument();
    expect(screen.getByText(/45.5%/)).toBeInTheDocument();
    expect(screen.getByText(/500.0 KB\/s/)).toBeInTheDocument();
  });

  test('displays different states correctly', async () => {
    renderWithContext(
      <DownloadProgress
        downloadProgressRef={mockDownloadProgressRef}
        downloadInitiatedRef={mockDownloadInitiatedRef}
      />
    );

    const [, processCallback] = mockSubscribe.mock.calls[0];

    const states = [
      { state: 'initiating', message: 'Initiating download...' },
      { state: 'downloading_audio', message: 'Downloading audio stream...' },
      { state: 'downloading_thumbnail', message: 'Downloading thumbnail...' },
      { state: 'merging', message: 'Merging formats...' },
      { state: 'metadata', message: 'Adding metadata...' },
      { state: 'processing', message: 'Processing file...' },
      { state: 'complete', message: 'Download completed' },
    ];

    for (const { state, message } of states) {
      await act(async () => {
        processCallback({
          progress: {
            jobId: 'test-job',
            progress: {
              percent: 50,
              downloadedBytes: 1024,
              totalBytes: 2048,
              speedBytesPerSecond: 512,
              etaSeconds: 60,
            },
            stalled: false,
            state,
          },
        });
      });

      await waitFor(() => {
        expect(screen.getByText(message)).toBeInTheDocument();
      });
    }
  });

  test('displays stalled state with yellow color', async () => {
    renderWithContext(
      <DownloadProgress
        downloadProgressRef={mockDownloadProgressRef}
        downloadInitiatedRef={mockDownloadInitiatedRef}
      />
    );

    const [, processCallback] = mockSubscribe.mock.calls[0];

    await act(async () => {
      processCallback({
        progress: {
          jobId: 'test-job',
          progress: {
            percent: 30,
            downloadedBytes: 1024,
            totalBytes: 2048,
            speedBytesPerSecond: 0,
            etaSeconds: 0,
          },
          stalled: true,
          state: 'downloading_video',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Download stalled - retrying...')).toBeInTheDocument();
    });
  });

  test('displays video count for non-channel downloads', async () => {
    renderWithContext(
      <DownloadProgress
        downloadProgressRef={mockDownloadProgressRef}
        downloadInitiatedRef={mockDownloadInitiatedRef}
      />
    );

    const [, processCallback] = mockSubscribe.mock.calls[0];

    await act(async () => {
      processCallback({
        progress: {
          jobId: 'test-job',
          progress: {
            percent: 50,
            downloadedBytes: 1024,
            totalBytes: 2048,
            speedBytesPerSecond: 512,
            etaSeconds: 60,
          },
          stalled: false,
          state: 'downloading_video',
          downloadType: 'Manual Downloads',
          videoCount: {
            current: 2,
            total: 5,
            completed: 1,
            skipped: 0,
            skippedThisChannel: 0,
          },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Videos: 2 of 5')).toBeInTheDocument();
    });
  });

  test('displays final summary after completion', async () => {
    renderWithContext(
      <DownloadProgress
        downloadProgressRef={mockDownloadProgressRef}
        downloadInitiatedRef={mockDownloadInitiatedRef}
      />
    );

    const [, processCallback] = mockSubscribe.mock.calls[0];

    await act(async () => {
      processCallback({
        finalSummary: {
          totalDownloaded: 5,
          totalSkipped: 2,
          jobType: 'Channel Downloads',
          completedAt: '2024-01-15T10:30:00Z',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Summary of last job')).toBeInTheDocument();
    });
    expect(screen.getByText(/5 new videos downloaded, 2 already existed or members only/)).toBeInTheDocument();
    expect(screen.getByText(/Channel update.*Completed/)).toBeInTheDocument();
  });

  test('displays final summary with single video grammar', async () => {
    renderWithContext(
      <DownloadProgress
        downloadProgressRef={mockDownloadProgressRef}
        downloadInitiatedRef={mockDownloadInitiatedRef}
      />
    );

    const [, processCallback] = mockSubscribe.mock.calls[0];

    await act(async () => {
      processCallback({
        finalSummary: {
          totalDownloaded: 1,
          totalSkipped: 0,
          jobType: 'Manually Added Urls',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/1 new video downloaded/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Manual download/)).toBeInTheDocument();
  });

  test('displays error with cookies required', async () => {
    const user = userEvent.setup();
    renderWithContext(
      <DownloadProgress
        downloadProgressRef={mockDownloadProgressRef}
        downloadInitiatedRef={mockDownloadInitiatedRef}
      />
    );

    const [, processCallback] = mockSubscribe.mock.calls[0];

    await act(async () => {
      processCallback({
        error: true,
        text: 'Bot detection encountered. Please update cookies.',
        errorCode: 'COOKIES_REQUIRED',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Download Failed')).toBeInTheDocument();
    });
    expect(screen.getByText('Bot detection encountered. Please update cookies.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Settings' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Go to Settings' }));
    expect(mockNavigate).toHaveBeenCalledWith('/configuration');
  });

  test('displays generic error without settings button', async () => {
    renderWithContext(
      <DownloadProgress
        downloadProgressRef={mockDownloadProgressRef}
        downloadInitiatedRef={mockDownloadInitiatedRef}
      />
    );

    const [, processCallback] = mockSubscribe.mock.calls[0];

    await act(async () => {
      processCallback({
        error: true,
        text: 'Network error occurred',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Download Failed')).toBeInTheDocument();
    });
    expect(screen.getByText('Network error occurred')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to Settings' })).not.toBeInTheDocument();
  });

  test('clears previous summary when new download starts', async () => {
    renderWithContext(
      <DownloadProgress
        downloadProgressRef={mockDownloadProgressRef}
        downloadInitiatedRef={mockDownloadInitiatedRef}
      />
    );

    const [, processCallback] = mockSubscribe.mock.calls[0];

    await act(async () => {
      processCallback({
        finalSummary: {
          totalDownloaded: 3,
          totalSkipped: 1,
          jobType: 'Channel Downloads',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Summary of last job')).toBeInTheDocument();
    });

    await act(async () => {
      processCallback({
        clearPreviousSummary: true,
      });
    });

    await waitFor(() => {
      expect(screen.queryByText('Summary of last job')).not.toBeInTheDocument();
    });
  });

  test('hides progress after completion with delay', async () => {
    jest.useFakeTimers();

    renderWithContext(
      <DownloadProgress
        downloadProgressRef={mockDownloadProgressRef}
        downloadInitiatedRef={mockDownloadInitiatedRef}
      />
    );

    const [, processCallback] = mockSubscribe.mock.calls[0];

    await act(async () => {
      processCallback({
        progress: {
          jobId: 'test-job',
          progress: {
            percent: 100,
            downloadedBytes: 2048,
            totalBytes: 2048,
            speedBytesPerSecond: 512,
            etaSeconds: 0,
          },
          stalled: false,
          state: 'complete',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Download completed')).toBeInTheDocument();
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.queryByText('Download completed')).not.toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  test('filters Unknown title in overlay', async () => {
    renderWithContext(
      <DownloadProgress
        downloadProgressRef={mockDownloadProgressRef}
        downloadInitiatedRef={mockDownloadInitiatedRef}
      />
    );

    const [, processCallback] = mockSubscribe.mock.calls[0];

    await act(async () => {
      processCallback({
        progress: {
          jobId: 'test-job',
          progress: {
            percent: 50,
            downloadedBytes: 1024,
            totalBytes: 2048,
            speedBytesPerSecond: 512,
            etaSeconds: 60,
          },
          stalled: false,
          state: 'downloading_video',
          videoInfo: {
            channel: 'Test Channel',
            title: 'Unknown title',
            displayTitle: 'Unknown title',
          },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Downloading video stream...')).toBeInTheDocument();
    });
    expect(screen.queryByText('Unknown title')).not.toBeInTheDocument();
  });

  test('handles WebSocket context not found', () => {
    expect(() => {
      render(
        <DownloadProgress
          downloadProgressRef={mockDownloadProgressRef}
          downloadInitiatedRef={mockDownloadInitiatedRef}
        />
      );
    }).toThrow('WebSocketContext not found');
  });

  test('formats bytes correctly', async () => {
    renderWithContext(
      <DownloadProgress
        downloadProgressRef={mockDownloadProgressRef}
        downloadInitiatedRef={mockDownloadInitiatedRef}
      />
    );

    const [, processCallback] = mockSubscribe.mock.calls[0];

    // Test single case with 5MB
    await act(async () => {
      processCallback({
        progress: {
          jobId: 'test-job',
          progress: {
            percent: 50,
            downloadedBytes: 5242880,  // 5 MB
            totalBytes: 10485760,// 10 MB
            speedBytesPerSecond: 1048576, // 1 MB/s
            etaSeconds: 60,
          },
          stalled: false,
          state: 'downloading_video',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/1\.0 MB\/s/)).toBeInTheDocument();
    });
    expect(screen.getByText(/5\.0 MB.*10\.0 MB/)).toBeInTheDocument();
  });

  test('handles playlist count from text messages', async () => {
    renderWithContext(
      <DownloadProgress
        downloadProgressRef={mockDownloadProgressRef}
        downloadInitiatedRef={mockDownloadInitiatedRef}
      />
    );

    const [, processCallback] = mockSubscribe.mock.calls[0];

    await act(async () => {
      processCallback({
        text: '[youtube:tab] Playlist Test Playlist: Downloading 8 items of 15',
      });
    });

    await act(async () => {
      processCallback({
        progress: {
          jobId: 'test-job',
          progress: {
            percent: 50,
            downloadedBytes: 1024,
            totalBytes: 2048,
            speedBytesPerSecond: 512,
            etaSeconds: 60,
          },
          stalled: false,
          state: 'downloading_video',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/of 15/)).toBeInTheDocument();
    });
  });

  test('resets video count on new download session', async () => {
    mockDownloadInitiatedRef.current = true;

    renderWithContext(
      <DownloadProgress
        downloadProgressRef={mockDownloadProgressRef}
        downloadInitiatedRef={mockDownloadInitiatedRef}
      />
    );

    const [, processCallback] = mockSubscribe.mock.calls[0];

    await act(async () => {
      processCallback({
        progress: {
          jobId: 'test-job',
          progress: {
            percent: 50,
            downloadedBytes: 1024,
            totalBytes: 2048,
            speedBytesPerSecond: 512,
            etaSeconds: 60,
          },
          stalled: false,
          state: 'downloading_video',
          videoCount: {
            current: 5,
            total: 10,
            completed: 4,
            skipped: 1,
            skippedThisChannel: 0,
          },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/5 of 10/)).toBeInTheDocument();
    });

    await act(async () => {
      processCallback({
        text: '[youtube:tab] Extracting URL: https://youtube.com/channel/test',
      });
    });

    expect(mockDownloadInitiatedRef.current).toBe(false);
  });

  test('handles zero bytes gracefully', async () => {
    renderWithContext(
      <DownloadProgress
        downloadProgressRef={mockDownloadProgressRef}
        downloadInitiatedRef={mockDownloadInitiatedRef}
      />
    );

    const [, processCallback] = mockSubscribe.mock.calls[0];

    await act(async () => {
      processCallback({
        progress: {
          jobId: 'test-job',
          progress: {
            percent: 0,
            downloadedBytes: 0,
            totalBytes: 0,
            speedBytesPerSecond: 0,
            etaSeconds: 0,
          },
          stalled: false,
          state: 'initiating',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Initiating download...')).toBeInTheDocument();
    });
    expect(screen.getByText(/0 B\/s.*0.0%.*0 B.*0 B/)).toBeInTheDocument();
  });

  test('hides progress on error state', async () => {
    renderWithContext(
      <DownloadProgress
        downloadProgressRef={mockDownloadProgressRef}
        downloadInitiatedRef={mockDownloadInitiatedRef}
      />
    );

    const [, processCallback] = mockSubscribe.mock.calls[0];

    // First show progress
    await act(async () => {
      processCallback({
        progress: {
          jobId: 'test-job',
          progress: {
            percent: 30,
            downloadedBytes: 1024,
            totalBytes: 2048,
            speedBytesPerSecond: 512,
            etaSeconds: 60,
          },
          stalled: false,
          state: 'downloading_video',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Downloading video stream...')).toBeInTheDocument();
    });

    // Then trigger error state
    await act(async () => {
      processCallback({
        progress: {
          jobId: 'test-job',
          progress: {
            percent: 30,
            downloadedBytes: 1024,
            totalBytes: 2048,
            speedBytesPerSecond: 0,
            etaSeconds: 0,
          },
          stalled: false,
          state: 'error',
        },
      });
    });

    // Progress should be hidden, returning to placeholder state
    await waitFor(() => {
      expect(screen.getByText('No download activity at the moment')).toBeInTheDocument();
    });
    expect(screen.queryByText('Downloading video stream...')).not.toBeInTheDocument();
  });
});