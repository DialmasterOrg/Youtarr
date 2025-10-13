import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import axios from 'axios';
import DownloadManager from '../DownloadManager';
import WebSocketContext from '../../contexts/WebSocketContext';
import { Job } from '../../types/Job';

jest.mock('axios', () => {
  const mock = {
    get: jest.fn(),
    post: jest.fn(),
  };
  return {
    __esModule: true,
    default: mock,
    get: mock.get,
    post: mock.post,
  };
});
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../DownloadManager/DownloadNew', () => ({
  __esModule: true,
  default: function MockDownloadNew({ videoUrls, setVideoUrls, token, fetchRunningJobs, downloadInitiatedRef }: any) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'download-new' },
      React.createElement('input', {
        'data-testid': 'video-urls-input',
        value: videoUrls,
        onChange: (e: any) => setVideoUrls(e.target.value),
        placeholder: 'Enter video URLs'
      }),
      React.createElement('button', {
        'data-testid': 'fetch-jobs-button',
        onClick: fetchRunningJobs
      }, 'Fetch Jobs'),
      React.createElement('button', {
        'data-testid': 'initiate-download-button',
        onClick: () => { downloadInitiatedRef.current = true; }
      }, 'Initiate Download')
    );
  }
}));

jest.mock('../DownloadManager/DownloadProgress', () => ({
  __esModule: true,
  default: function MockDownloadProgress({ downloadProgressRef, downloadInitiatedRef }: any) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'download-progress' },
      React.createElement('div', null, `Progress Index: ${downloadProgressRef.current.index}`),
      React.createElement('div', null, `Progress Message: ${downloadProgressRef.current.message}`),
      React.createElement('div', null, `Download Initiated: ${downloadInitiatedRef.current}`)
    );
  }
}));

jest.mock('../DownloadManager/DownloadHistory', () => ({
  __esModule: true,
  default: function MockDownloadHistory({ jobs, expanded, handleExpandCell, anchorEl, setAnchorEl, currentTime, isMobile }: any) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'download-history' },
      React.createElement('div', null, `Jobs Count: ${jobs.length}`),
      React.createElement('div', null, `Mobile View: ${isMobile}`),
      React.createElement('div', null, `Current Time: ${currentTime.toISOString()}`),
      jobs.map((job: any, index: number) =>
        React.createElement('div', { key: job.id, 'data-testid': `job-${job.id}` },
          React.createElement('span', null, job.jobType),
          React.createElement('button', {
            'data-testid': `expand-${job.id}`,
            onClick: () => handleExpandCell(job.id)
          }, expanded[job.id] ? 'Collapse' : 'Expand'),
          React.createElement('button', {
            'data-testid': `anchor-${job.id}`,
            onClick: (e: any) => setAnchorEl({ ...anchorEl, [job.id]: e.currentTarget })
          }, 'Set Anchor')
        )
      )
    );
  }
}));

describe('DownloadManager', () => {
  const mockToken = 'test-token-123';
  const mockSubscribe = jest.fn();
  const mockUnsubscribe = jest.fn();
  const mockWebSocketContextValue = {
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    socket: null,
    ws: {},
    isConnected: true,
  };

  const mockJobs: Job[] = [
    {
      id: '1',
      jobType: 'Channel Downloads',
      status: 'completed',
      output: 'Download completed successfully',
      timeCreated: 1704099600000,
      timeInitiated: 1704099600000,
      data: {
        videos: []
      }
    },
    {
      id: '2',
      jobType: 'Manual Downloads',
      status: 'completed',
      output: 'Download completed successfully',
      timeCreated: 1704103200000,
      timeInitiated: 1704103200000,
      data: {
        videos: []
      }
    },
  ];

  const renderWithContext = (component: React.ReactElement) => {
    return render(
      <WebSocketContext.Provider value={mockWebSocketContextValue}>
        {component}
      </WebSocketContext.Provider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockResolvedValue({ data: [] });
    mockedAxios.post.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Initialization', () => {
    test('renders all three main sections', () => {
      renderWithContext(<DownloadManager token={mockToken} />);

      expect(screen.getByTestId('download-new')).toBeInTheDocument();
      expect(screen.getByTestId('download-progress')).toBeInTheDocument();
      expect(screen.getByTestId('download-history')).toBeInTheDocument();
    });

    test('throws error when WebSocketContext is not provided', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<DownloadManager token={mockToken} />);
      }).toThrow('WebSocketContext not found');

      spy.mockRestore();
    });

    test('initializes with empty states', () => {
      renderWithContext(<DownloadManager token={mockToken} />);

      const input = screen.getByTestId('video-urls-input') as HTMLInputElement;
      expect(input.value).toBe('');
      expect(screen.getByText('Jobs Count: 0')).toBeInTheDocument();
      expect(screen.getByText('Download Initiated: false')).toBeInTheDocument();
      expect(screen.getByText('Progress Index: null')).toBeInTheDocument();
      expect(screen.getByText('Progress Message:')).toBeInTheDocument();
    });
  });

  describe('Jobs Fetching', () => {
    test('fetches running jobs on mount when token is provided', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockJobs });

      renderWithContext(<DownloadManager token={mockToken} />);

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith('/runningjobs', {
          headers: { 'x-access-token': mockToken }
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Jobs Count: 2')).toBeInTheDocument();
      });
    });

    test('does not fetch jobs when token is null', () => {
      renderWithContext(<DownloadManager token={null} />);

      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    test('handles empty response from server', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: null });

      renderWithContext(<DownloadManager token={mockToken} />);

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalled();
      });

      expect(screen.getByText('Jobs Count: 0')).toBeInTheDocument();
    });

    test('manual fetch updates jobs list', async () => {
      const user = userEvent.setup({ delay: null });
      mockedAxios.get.mockResolvedValueOnce({ data: [] });

      renderWithContext(<DownloadManager token={mockToken} />);

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      });

      mockedAxios.get.mockResolvedValueOnce({ data: mockJobs });

      await user.click(screen.getByTestId('fetch-jobs-button'));

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      });

      await waitFor(() => {
        expect(screen.getByText('Jobs Count: 2')).toBeInTheDocument();
      });
    });
  });

  describe('WebSocket Integration', () => {
    test('subscribes to WebSocket on mount', () => {
      renderWithContext(<DownloadManager token={mockToken} />);

      expect(mockSubscribe).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function)
      );
    });

    test('unsubscribes from WebSocket on unmount', () => {
      const { unmount } = renderWithContext(<DownloadManager token={mockToken} />);

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    test('filter function correctly identifies download complete messages', () => {
      renderWithContext(<DownloadManager token={mockToken} />);

      const [filterFunction] = mockSubscribe.mock.calls[0];

      expect(filterFunction({ destination: 'broadcast', type: 'downloadComplete' })).toBe(true);
      expect(filterFunction({ destination: 'broadcast', type: 'other' })).toBe(false);
      expect(filterFunction({ destination: 'private', type: 'downloadComplete' })).toBe(false);
    });

    test('processes download complete message by fetching jobs', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: [] });

      renderWithContext(<DownloadManager token={mockToken} />);

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      });

      const [, processCallback] = mockSubscribe.mock.calls[0];

      mockedAxios.get.mockResolvedValueOnce({ data: mockJobs });

      await act(async () => {
        processCallback({ type: 'downloadComplete' });
      });

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      });

      expect(screen.getByText('Jobs Count: 2')).toBeInTheDocument();
    });
  });

  describe('State Management', () => {
    test('manages videoUrls state correctly', async () => {
      const user = userEvent.setup({ delay: null });
      renderWithContext(<DownloadManager token={mockToken} />);

      const input = screen.getByTestId('video-urls-input') as HTMLInputElement;

      await user.type(input, 'https://youtube.com/watch?v=test123');

      expect(input.value).toBe('https://youtube.com/watch?v=test123');
    });

    test('manages download initiated ref', async () => {
      const user = userEvent.setup({ delay: null });
      renderWithContext(<DownloadManager token={mockToken} />);

      expect(screen.getByText('Download Initiated: false')).toBeInTheDocument();

      await user.click(screen.getByTestId('initiate-download-button'));

      await waitFor(() => {
        expect(screen.getByText('Download Initiated: true')).toBeInTheDocument();
      });
    });

    test('manages expanded state for jobs', async () => {
      const user = userEvent.setup({ delay: null });
      mockedAxios.get.mockResolvedValueOnce({ data: mockJobs });

      renderWithContext(<DownloadManager token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByTestId('job-1')).toBeInTheDocument();
      });

      const expandButton1 = screen.getByTestId('expand-1');
      expect(expandButton1.textContent).toBe('Expand');

      await user.click(expandButton1);

      expect(expandButton1.textContent).toBe('Collapse');

      await user.click(expandButton1);

      expect(expandButton1.textContent).toBe('Expand');
    });

    test('manages anchor elements for jobs', async () => {
      const user = userEvent.setup({ delay: null });
      mockedAxios.get.mockResolvedValueOnce({ data: mockJobs });

      renderWithContext(<DownloadManager token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByTestId('job-1')).toBeInTheDocument();
      });

      const anchorButton = screen.getByTestId('anchor-1');

      await user.click(anchorButton);
    });

    test('updates current time every second', () => {
      jest.useFakeTimers();

      renderWithContext(<DownloadManager token={mockToken} />);

      const initialTime = screen.getByText(/Current Time:/).textContent;

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      const updatedTime = screen.getByText(/Current Time:/).textContent;
      expect(updatedTime).not.toBe(initialTime);

      jest.useRealTimers();
    });

    test('clears timer interval on unmount', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      const { unmount } = renderWithContext(<DownloadManager token={mockToken} />);

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Responsive Design', () => {
    test('passes mobile prop based on media query', async () => {
      renderWithContext(<DownloadManager token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('Mobile View: false')).toBeInTheDocument();
      });
    });
  });

  describe('Component Props', () => {
    test('passes correct props to DownloadNew', async () => {
      renderWithContext(<DownloadManager token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByTestId('download-new')).toBeInTheDocument();
      });

      expect(screen.getByTestId('video-urls-input')).toBeInTheDocument();
      expect(screen.getByTestId('fetch-jobs-button')).toBeInTheDocument();
    });

    test('passes correct props to DownloadProgress', async () => {
      renderWithContext(<DownloadManager token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByTestId('download-progress')).toBeInTheDocument();
      });

      expect(screen.getByText('Progress Index: null')).toBeInTheDocument();
      expect(screen.getByText('Progress Message:')).toBeInTheDocument();
    });

    test('passes correct props to DownloadHistory', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockJobs });

      renderWithContext(<DownloadManager token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByTestId('download-history')).toBeInTheDocument();
      });

      expect(screen.getByText('Jobs Count: 2')).toBeInTheDocument();
      expect(screen.getByText('Mobile View: false')).toBeInTheDocument();
      expect(screen.getByText(/Current Time:/)).toBeInTheDocument();
    });
  });


  describe('Integration with Child Components', () => {
    test('multiple expanded states work independently', async () => {
      const user = userEvent.setup({ delay: null });
      mockedAxios.get.mockResolvedValueOnce({ data: mockJobs });

      renderWithContext(<DownloadManager token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByTestId('job-1')).toBeInTheDocument();
      });

      const expandButton1 = screen.getByTestId('expand-1');
      const expandButton2 = screen.getByTestId('expand-2');

      expect(expandButton1.textContent).toBe('Expand');
      expect(expandButton2.textContent).toBe('Expand');

      await user.click(expandButton1);

      expect(expandButton1.textContent).toBe('Collapse');
      expect(expandButton2.textContent).toBe('Expand');

      await user.click(expandButton2);

      expect(expandButton1.textContent).toBe('Collapse');
      expect(expandButton2.textContent).toBe('Collapse');
    });

    test('ref updates are reflected in child components', async () => {
      const user = userEvent.setup({ delay: null });
      renderWithContext(<DownloadManager token={mockToken} />);

      expect(screen.getByText('Download Initiated: false')).toBeInTheDocument();

      await user.click(screen.getByTestId('initiate-download-button'));

      await waitFor(() => {
        expect(screen.getByText('Download Initiated: true')).toBeInTheDocument();
      });
    });
  });
});