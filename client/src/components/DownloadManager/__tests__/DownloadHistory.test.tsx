import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DownloadHistory from '../DownloadHistory';
import { useConfig } from '../../../hooks/useConfig';
import { Job } from '../../../types/Job';
import { VideoData } from '../../../types/VideoData';

// Mock react-swipeable
jest.mock('react-swipeable', () => ({
  useSwipeable: jest.fn(() => ({})),
}));

// Mock formatDuration utility
jest.mock('../../../utils', () => ({
  formatDuration: jest.fn((duration: number) => {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }),
}));

jest.mock('../../../hooks/useConfig', () => ({
  useConfig: jest.fn(),
}));

// Mock VideoModal: render a visible wrapper with a button that fires onVideoDeleted,
// so tests can drive the deletion wiring without the real modal's async flow.
jest.mock('../../shared/VideoModal', () => ({
  __esModule: true,
  default: function MockVideoModal(props: {
    open: boolean;
    onVideoDeleted?: (youtubeId: string) => void;
    video: { youtubeId: string; status: string };
  }) {
    const React = require('react');
    if (!props.open) return null;
    return React.createElement(
      'div',
      { 'data-testid': 'mock-video-modal' },
      React.createElement(
        'span',
        { 'data-testid': 'mock-video-status' },
        props.video.status
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'mock-delete-video',
          onClick: () => props.onVideoDeleted?.(props.video.youtubeId),
        },
        'Mock Delete'
      )
    );
  },
}));

const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;

function makeVideo(overrides: Partial<VideoData> = {}): VideoData {
  return {
    id: 1,
    youtubeId: 'video1',
    youTubeChannelName: 'Test Channel',
    youTubeVideoName: 'Test Video 1',
    duration: 120,
    timeCreated: '2024-01-15T09:00:00Z',
    originalDate: null,
    description: null,
    ...overrides,
  };
}

function makeMultiVideoJob(id: string, videos: VideoData[]): Job {
  return {
    id,
    jobType: 'Channel Downloads',
    status: 'Completed',
    output: '',
    timeCreated: new Date('2024-01-15T09:00:00Z').getTime(),
    timeInitiated: new Date('2024-01-15T09:00:30Z').getTime(),
    data: { videos },
  };
}

describe('DownloadHistory', () => {
  const mockHandleExpandCell = jest.fn();

  const defaultProps = {
    jobs: [],
    currentTime: new Date('2024-01-15T10:30:00Z'),
    expanded: {},
    handleExpandCell: mockHandleExpandCell,
    isMobile: false,
  };

  const sampleJobs: Job[] = [
    {
      id: 'job-1',
      jobType: 'Channel Downloads',
      status: 'Completed',
      output: '',
      timeCreated: new Date('2024-01-15T09:00:00Z').getTime(),
      timeInitiated: new Date('2024-01-15T09:00:30Z').getTime(),
      data: {
        videos: [
          {
            id: 1,
            youtubeId: 'video1',
            youTubeChannelName: 'Test Channel',
            youTubeVideoName: 'Test Video 1',
            duration: 120,
            timeCreated: '2024-01-15T09:00:00Z',
            originalDate: null,
            description: null,
          } as VideoData,
          {
            id: 2,
            youtubeId: 'video2',
            youTubeChannelName: 'Test Channel',
            youTubeVideoName: 'Test Video 2',
            duration: 240,
            timeCreated: '2024-01-15T09:00:00Z',
            originalDate: null,
            description: null,
          } as VideoData,
        ],
      },
    },
    {
      id: 'job-2',
      jobType: 'Manually Added Urls',
      status: 'Failed',
      output: '',
      timeCreated: new Date('2024-01-15T08:30:00Z').getTime(),
      timeInitiated: new Date('2024-01-15T08:30:30Z').getTime(),
      data: {
        videos: [],
      },
    },
    {
      id: 'job-3',
      jobType: 'Channel Downloads',
      status: 'In Progress',
      output: '',
      timeCreated: new Date('2024-01-15T10:00:00Z').getTime(),
      timeInitiated: new Date('2024-01-15T10:00:30Z').getTime(),
      data: {
        videos: [],
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseConfig.mockReturnValue({
      config: { channelVideosHotLoad: false },
    } as ReturnType<typeof useConfig>);
  });

  test('renders with title and no jobs message when jobs array is empty', () => {
    render(<DownloadHistory {...defaultProps} />);

    expect(screen.getByText('Download History')).toBeInTheDocument();
    expect(screen.getByText('No jobs currently running')).toBeInTheDocument();
  });

  test('renders job list with basic information', () => {
    // Note: By default, the component filters out jobs with empty videos array
    // but shows jobs with videos or undefined data
    render(<DownloadHistory {...defaultProps} jobs={sampleJobs} />);

    const tableCells = screen.getAllByRole('cell');

    // Verify we have cells
    expect(tableCells.length).toBeGreaterThan(0);

    // Check that content exists in the table
    const cellTexts = tableCells.map(cell => cell.textContent || '');
    const allText = cellTexts.join(' ');

    // Should have job types - job-1 has videos, job-3 has empty videos array but is in progress
    expect(allText).toContain('Channel');

    // Should have statuses or duration
    expect(allText).toMatch(/Completed|m\d+s/);
  });

  test('displays "---" for in-progress jobs without videos', () => {
    const testJobs: Job[] = [
      sampleJobs[0], // Has 2 videos
      {
        ...sampleJobs[2], // In Progress job
        data: undefined as any, // Make data undefined so it shows
      },
    ];
    render(<DownloadHistory {...defaultProps} jobs={testJobs} />);

    const tableCells = screen.getAllByRole('cell');
    const cellTexts = tableCells.map(cell => cell.textContent || '');

    // Check for "---" for in-progress job
    expect(cellTexts.some(text => text === '---')).toBe(true);
  });

  test('calculates duration for in-progress jobs', () => {
    const currentTime = new Date('2024-01-15T10:30:45Z');
    // Make the in-progress job have undefined data so it's displayed
    const inProgressJob: Job[] = [{
      ...sampleJobs[2],
      data: undefined as any,
    }];
    render(<DownloadHistory {...defaultProps} jobs={inProgressJob} currentTime={currentTime} />);

    // Job started at 10:00:30, current time is 10:30:45 = 30m15s
    const tableCells = screen.getAllByRole('cell');
    const cellTexts = tableCells.map(cell => cell.textContent || '');

    // Look for the duration string
    expect(cellTexts.some(text => text === '30m15s')).toBe(true);
  });

  test('handles show/hide jobs with no videos checkbox', async () => {
    const user = userEvent.setup();

    render(<DownloadHistory {...defaultProps} jobs={sampleJobs} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Show jobs with no videos' });
    expect(checkbox).not.toBeChecked();

    // Count initial rows
    const initialRows = screen.getAllByRole('row');
    expect(initialRows.length).toBeGreaterThan(1); // At least header + some jobs

    // Check the checkbox
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    // Count rows after checking
    const rowsAfterCheck = screen.getAllByRole('row');
    expect(rowsAfterCheck.length).toBeGreaterThan(1); // Still have header + jobs

    // Verify checkbox actually changed
    expect(checkbox).toBeChecked();
  });

  test('handles pagination with many jobs', async () => {
    const user = userEvent.setup();

    // Create 15 jobs to test pagination (12 per page)
    // All jobs need videos to avoid being filtered out
    const manyJobs: Job[] = Array.from({ length: 15 }, (_, i) => ({
      id: `job-${i}`,
      jobType: 'Channel Downloads',
      status: 'Completed',
      output: '',
      timeCreated: Date.now() - i * 1000000,
      timeInitiated: Date.now() - i * 1000000 + 30000,
      data: {
        videos: [{
          id: i + 1,
          youtubeId: `v${i}`,
          youTubeChannelName: 'Test',
          youTubeVideoName: `Video ${i}`,
          duration: 100,
          timeCreated: new Date().toISOString(),
          originalDate: null,
          description: null,
        } as VideoData],
      },
    }));

    render(<DownloadHistory {...defaultProps} jobs={manyJobs} />);

    // Should show first 12 jobs on page 1
    let tableRows = screen.getAllByRole('row');
    expect(tableRows).toHaveLength(13); // 1 header + 12 jobs

    // Find pagination
    const pagination = screen.getByRole('navigation');
    expect(pagination).toBeInTheDocument();

    // Find and click page 2 button
    const page2Button = screen.getByLabelText(/go to page 2/i);
    await user.click(page2Button);

    // Should now show remaining 3 jobs
    await waitFor(() => {
      const updatedRows = screen.getAllByRole('row');
      expect(updatedRows).toHaveLength(4); // 1 header + 3 jobs
    });
  });

  test('handles mobile view with a single-video job', () => {
    const singleVideoJob: Job[] = [{
      id: 'single-job',
      jobType: 'Channel Downloads',
      status: 'Completed',
      output: '',
      timeCreated: new Date('2024-01-15T09:00:00Z').getTime(),
      timeInitiated: new Date('2024-01-15T09:00:30Z').getTime(),
      data: {
        videos: [{
          id: 1,
          youtubeId: 'video1',
          youTubeChannelName: 'Test Channel',
          youTubeVideoName: 'Test Video 1',
          duration: 120,
          timeCreated: '2024-01-15T09:00:00Z',
          originalDate: null,
          description: null,
        } as VideoData],
      },
    }];

    render(<DownloadHistory {...defaultProps} jobs={singleVideoJob} isMobile={true} />);

    expect(screen.getByText('Download History')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Test Video 1' })).toBeInTheDocument();
    expect(screen.getByText('Test Channel')).toBeInTheDocument();
    expect(screen.getByText(/Date:/)).toBeInTheDocument();
    expect(screen.getByText(/Source:/)).toBeInTheDocument();
    expect(screen.getByText(/Status:/)).toBeInTheDocument();
  });

  test('mobile view shows "Multiple (N)" title for multi-video jobs and hides the single-video header info', () => {
    render(<DownloadHistory {...defaultProps} jobs={sampleJobs} isMobile={true} />);

    expect(screen.getByText('Multiple (2)')).toBeInTheDocument();
    // Top-level header info for a single video must not leak into multi-video card
    expect(screen.queryByRole('button', { name: 'Test Video 1' })).not.toBeInTheDocument();
    expect(screen.queryByText('Test Channel')).not.toBeInTheDocument();
  });

  test('formats time with AM/PM', () => {
    const jobsWithTimes: Job[] = [
      {
        id: 'morning',
        jobType: 'Channel Downloads',
        status: 'In Progress', // Make it in-progress so it's shown
        output: '',
        timeCreated: new Date(2024, 0, 15, 9, 30).getTime(),
        timeInitiated: Date.now(),
        data: { videos: [] },
      },
      {
        id: 'evening',
        jobType: 'Channel Downloads',
        status: 'Completed',
        output: '',
        timeCreated: new Date(2024, 0, 15, 21, 30).getTime(),
        timeInitiated: Date.now(),
        data: { videos: [{
          id: 1,
          youtubeId: 'v1',
          youTubeChannelName: 'Test',
          youTubeVideoName: 'Video',
          duration: 100,
          timeCreated: new Date().toISOString(),
          originalDate: null,
          description: null,
        } as VideoData] }, // Give it videos so it's shown
      },
    ];

    render(<DownloadHistory {...defaultProps} jobs={jobsWithTimes} />);

    const tableCells = screen.getAllByRole('cell');
    const cellTexts = tableCells.map(cell => cell.textContent || '');
    const allText = cellTexts.join(' ');

    // Check for AM/PM time format
    expect(allText).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/);
  });

  test('resets pagination when checkbox changes', async () => {
    const user = userEvent.setup();

    // Create enough jobs - mix of with videos and without
    const manyJobs: Job[] = Array.from({ length: 15 }, (_, i) => ({
      id: `job-${i}`,
      jobType: 'Channel Downloads',
      status: 'Completed',
      output: '',
      timeCreated: Date.now() - i * 1000000,
      timeInitiated: Date.now() - i * 1000000 + 30000,
      data: {
        videos: [{
          id: i + 1,
          youtubeId: `v${i}`,
          youTubeChannelName: 'Test',
          youTubeVideoName: 'Video',
          duration: 100,
          timeCreated: new Date().toISOString(),
          originalDate: null,
          description: null,
        } as VideoData],
      },
    }));

    render(<DownloadHistory {...defaultProps} jobs={manyJobs} />);

    // Navigate to page 2
    const page2Button = screen.getByLabelText(/go to page 2/i);
    await user.click(page2Button);

    // Wait for page change
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows).toHaveLength(4); // 1 header + 3 jobs on page 2
    });

    // Click the checkbox - this should reset to page 1
    const checkbox = screen.getByRole('checkbox', { name: 'Show jobs with no videos' });
    await user.click(checkbox);

    // Should reset to page 1
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThanOrEqual(13); // At least 1 header + 12 jobs on page 1
    });
  });

  test('handles jobs with undefined or null data', () => {
    const jobsWithBadData: Job[] = [
      {
        id: 'job-no-data',
        jobType: 'Channel Downloads',
        status: 'Completed',
        output: '',
        timeCreated: Date.now(),
        timeInitiated: Date.now(),
        data: undefined as any,
      },
      {
        id: 'job-null-videos',
        jobType: 'Manually Added Urls',
        status: 'Completed',
        output: '',
        timeCreated: Date.now(),
        timeInitiated: Date.now(),
        data: {
          videos: null as any,
        },
      },
    ];

    render(<DownloadHistory {...defaultProps} jobs={jobsWithBadData} />);

    // Should render without crashing and show "None" for videos
    const tableCells = screen.getAllByRole('cell');
    const cellTexts = tableCells.map(cell => cell.textContent || '');

    // Should have "None" for jobs without videos
    expect(cellTexts.filter(text => text === 'None').length).toBeGreaterThanOrEqual(2);
  });

  test('filters jobs correctly with checkbox', async () => {
    const user = userEvent.setup();
    const mixedJobs: Job[] = [
      {
        id: 'job-with-videos',
        jobType: 'Channel Downloads',
        status: 'Completed',
        output: '',
        timeCreated: Date.now(),
        timeInitiated: Date.now(),
        data: {
          videos: [{
            id: 1,
            youtubeId: 'v1',
            youTubeChannelName: 'Ch1',
            youTubeVideoName: 'Vid1',
            duration: 100,
            timeCreated: new Date().toISOString(),
            originalDate: null,
            description: null,
          } as VideoData],
        },
      },
      {
        id: 'job-no-videos',
        jobType: 'Channel Downloads',
        status: 'Completed',
        output: '',
        timeCreated: Date.now(),
        timeInitiated: Date.now(),
        data: {
          videos: [],
        },
      },
    ];

    render(<DownloadHistory {...defaultProps} jobs={mixedJobs} />);

    // With default checkbox state (unchecked), job with empty videos array is filtered out
    // Only job-with-videos should show
    let rows = screen.getAllByRole('row');
    expect(rows.length).toBe(2); // 1 header + 1 job (job-with-videos only)

    // Toggle checkbox to show all jobs
    const checkbox = screen.getByRole('checkbox', { name: 'Show jobs with no videos' });
    await user.click(checkbox);

    // After checking, both jobs should be visible
    await waitFor(() => {
      const allRows = screen.getAllByRole('row');
      expect(allRows.length).toBe(3); // 1 header + 2 jobs
    });
  });

  describe('API Source Indicator', () => {
    test('displays "Manual Videos" for standard manual downloads', () => {
      const manualJob: Job[] = [{
        id: 'manual-job',
        jobType: 'Manually Added Urls',
        status: 'Completed',
        output: '',
        timeCreated: Date.now(),
        timeInitiated: Date.now(),
        data: {
          videos: [{
            id: 1,
            youtubeId: 'v1',
            youTubeChannelName: 'Test',
            youTubeVideoName: 'Manual Video',
            duration: 100,
            timeCreated: new Date().toISOString(),
            originalDate: null,
            description: null,
          } as VideoData],
        },
      }];

      render(<DownloadHistory {...defaultProps} jobs={manualJob} />);

      const tableCells = screen.getAllByRole('cell');
      const cellTexts = tableCells.map(cell => cell.textContent || '');
      expect(cellTexts.some(text => text === 'Manual Videos')).toBe(true);
    });

    test('displays "API: KeyName" for API-triggered downloads', () => {
      const apiJob: Job[] = [{
        id: 'api-job',
        jobType: 'Manually Added Urls (via API: My Bookmarklet)',
        status: 'Completed',
        output: '',
        timeCreated: Date.now(),
        timeInitiated: Date.now(),
        data: {
          videos: [{
            id: 1,
            youtubeId: 'v1',
            youTubeChannelName: 'Test',
            youTubeVideoName: 'API Video',
            duration: 100,
            timeCreated: new Date().toISOString(),
            originalDate: null,
            description: null,
          } as VideoData],
        },
      }];

      render(<DownloadHistory {...defaultProps} jobs={apiJob} />);

      const tableCells = screen.getAllByRole('cell');
      const cellTexts = tableCells.map(cell => cell.textContent || '');
      expect(cellTexts.some(text => text === 'API: My Bookmarklet')).toBe(true);
    });

    test('displays "Channels" for channel downloads', () => {
      const channelJob: Job[] = [{
        id: 'channel-job',
        jobType: 'Channel Downloads',
        status: 'Completed',
        output: '',
        timeCreated: Date.now(),
        timeInitiated: Date.now(),
        data: {
          videos: [{
            id: 1,
            youtubeId: 'v1',
            youTubeChannelName: 'Test',
            youTubeVideoName: 'Channel Video',
            duration: 100,
            timeCreated: new Date().toISOString(),
            originalDate: null,
            description: null,
          } as VideoData],
        },
      }];

      render(<DownloadHistory {...defaultProps} jobs={channelJob} />);

      const tableCells = screen.getAllByRole('cell');
      const cellTexts = tableCells.map(cell => cell.textContent || '');
      expect(cellTexts.some(text => text === 'Channels')).toBe(true);
    });

    test('hides the idle playlist sweep by default', () => {
      const sweepJob: Job[] = [{
        id: 'sweep-job',
        jobType: 'Playlist Downloads',
        status: 'Complete',
        output: '',
        timeCreated: Date.now(),
        timeInitiated: Date.now(),
        data: { videos: [] },
      }];

      render(<DownloadHistory {...defaultProps} jobs={sweepJob} />);

      const tableCells = screen.getAllByRole('cell');
      const cellTexts = tableCells.map(cell => cell.textContent || '');
      expect(cellTexts.some(text => text === 'Playlists')).toBe(false);
      expect(screen.getByText('No jobs currently running')).toBeInTheDocument();
    });

    test('displays the idle playlist sweep when "Show jobs with no videos" is checked', async () => {
      const user = userEvent.setup();
      const sweepJob: Job[] = [{
        id: 'sweep-job',
        jobType: 'Playlist Downloads',
        status: 'Complete',
        output: '',
        timeCreated: Date.now(),
        timeInitiated: Date.now(),
        data: { videos: [] },
      }];

      render(<DownloadHistory {...defaultProps} jobs={sweepJob} />);

      await user.click(screen.getByRole('checkbox', { name: 'Show jobs with no videos' }));

      const tableCells = screen.getAllByRole('cell');
      const cellTexts = tableCells.map(cell => cell.textContent || '');
      expect(cellTexts.some(text => text === 'Playlists')).toBe(true);
      expect(cellTexts.some(text => text === 'Complete - no new videos')).toBe(true);
    });

    test('displays "Playlists" for a playlist download job with videos', () => {
      const playlistJob: Job[] = [{
        id: 'playlist-job',
        jobType: 'Playlist: My Cool Playlist',
        status: 'Complete',
        output: '',
        timeCreated: Date.now(),
        timeInitiated: Date.now(),
        data: {
          videos: [{
            id: 1,
            youtubeId: 'v1',
            youTubeChannelName: 'Test',
            youTubeVideoName: 'Playlist Video',
            duration: 100,
            timeCreated: new Date().toISOString(),
            originalDate: null,
            description: null,
          } as VideoData],
        },
      }];

      render(<DownloadHistory {...defaultProps} jobs={playlistJob} />);

      const tableCells = screen.getAllByRole('cell');
      const cellTexts = tableCells.map(cell => cell.textContent || '');
      expect(cellTexts.some(text => text === 'Playlists')).toBe(true);
    });

    test('extracts API key name with special characters', () => {
      const apiJob: Job[] = [{
        id: 'api-job',
        jobType: 'Manually Added Urls (via API: iPhone Shortcut #1)',
        status: 'Completed',
        output: '',
        timeCreated: Date.now(),
        timeInitiated: Date.now(),
        data: {
          videos: [{
            id: 1,
            youtubeId: 'v1',
            youTubeChannelName: 'Test',
            youTubeVideoName: 'API Video',
            duration: 100,
            timeCreated: new Date().toISOString(),
            originalDate: null,
            description: null,
          } as VideoData],
        },
      }];

      render(<DownloadHistory {...defaultProps} jobs={apiJob} />);

      const tableCells = screen.getAllByRole('cell');
      const cellTexts = tableCells.map(cell => cell.textContent || '');
      expect(cellTexts.some(text => text === 'API: iPhone Shortcut #1')).toBe(true);
    });
  });

  describe('Missing video indicators (multi-video jobs)', () => {
    test('desktop summary row shows "N missing" chip when at least one video is removed', () => {
      const job = makeMultiVideoJob('job-multi', [
        makeVideo({ id: 1, youtubeId: 'v1', youTubeVideoName: 'Video A' }),
        makeVideo({ id: 2, youtubeId: 'v2', youTubeVideoName: 'Video B', removed: true }),
        makeVideo({ id: 3, youtubeId: 'v3', youTubeVideoName: 'Video C' }),
      ]);

      render(<DownloadHistory {...defaultProps} jobs={[job]} />);

      expect(screen.getByText('Multiple (3)')).toBeInTheDocument();
      expect(screen.getByText('1 missing')).toBeInTheDocument();
    });

    test('desktop summary row hides the aggregate chip when no videos are removed', () => {
      const job = makeMultiVideoJob('job-multi-none', [
        makeVideo({ id: 1, youtubeId: 'v1' }),
        makeVideo({ id: 2, youtubeId: 'v2' }),
      ]);

      render(<DownloadHistory {...defaultProps} jobs={[job]} />);

      expect(screen.getByText('Multiple (2)')).toBeInTheDocument();
      expect(screen.queryByText(/missing/i)).not.toBeInTheDocument();
    });

    test('desktop expanded row shows "Missing" chip next to removed videos only', () => {
      const job = makeMultiVideoJob('job-multi-expanded', [
        makeVideo({ id: 1, youtubeId: 'v1', youTubeVideoName: 'Kept Video' }),
        makeVideo({ id: 2, youtubeId: 'v2', youTubeVideoName: 'Gone Video', removed: true }),
      ]);

      render(
        <DownloadHistory
          {...defaultProps}
          jobs={[job]}
          expanded={{ 'job-multi-expanded': true }}
        />
      );

      expect(screen.getByRole('button', { name: 'Gone Video' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Kept Video' })).toBeInTheDocument();
      expect(screen.getByText('Missing')).toBeInTheDocument();
    });

    test('mobile summary card shows "N missing" chip when at least one video is removed', () => {
      const job = makeMultiVideoJob('job-mobile-multi', [
        makeVideo({ id: 1, youtubeId: 'v1' }),
        makeVideo({ id: 2, youtubeId: 'v2', removed: true }),
      ]);

      render(<DownloadHistory {...defaultProps} jobs={[job]} isMobile />);

      expect(screen.getByText('Multiple (2)')).toBeInTheDocument();
      expect(screen.getByText('1 missing')).toBeInTheDocument();
    });

    test('mobile summary card hides the aggregate chip when no videos are removed', () => {
      const job = makeMultiVideoJob('job-mobile-multi-clean', [
        makeVideo({ id: 1, youtubeId: 'v1' }),
        makeVideo({ id: 2, youtubeId: 'v2' }),
      ]);

      render(<DownloadHistory {...defaultProps} jobs={[job]} isMobile />);

      expect(screen.getByText('Multiple (2)')).toBeInTheDocument();
      expect(screen.queryByText(/missing/i)).not.toBeInTheDocument();
    });

    test('mobile expanded card shows per-video "Missing" chip only for removed videos', () => {
      const job = makeMultiVideoJob('job-mobile-expanded', [
        makeVideo({ id: 1, youtubeId: 'v1', youTubeVideoName: 'Present Video' }),
        makeVideo({ id: 2, youtubeId: 'v2', youTubeVideoName: 'Removed Video', removed: true }),
      ]);

      render(
        <DownloadHistory
          {...defaultProps}
          jobs={[job]}
          isMobile
          expanded={{ 'job-mobile-expanded': true }}
        />
      );

      expect(screen.getByRole('button', { name: 'Present Video' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Removed Video' })).toBeInTheDocument();
      expect(screen.getByText('Missing')).toBeInTheDocument();
    });
  });

  describe('Video deletion wiring', () => {
    test('invokes onVideoDeleted after a video is deleted via the modal', async () => {
      const user = userEvent.setup();
      const onVideoDeleted = jest.fn();
      const job = makeMultiVideoJob('job-delete', [
        makeVideo({ id: 1, youtubeId: 'del-1', youTubeVideoName: 'Deletable Video' }),
        makeVideo({ id: 2, youtubeId: 'del-2', youTubeVideoName: 'Other Video' }),
      ]);

      render(
        <DownloadHistory
          {...defaultProps}
          jobs={[job]}
          expanded={{ 'job-delete': true }}
          onVideoDeleted={onVideoDeleted}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Deletable Video' }));
      expect(screen.getByTestId('mock-video-modal')).toBeInTheDocument();

      await user.click(screen.getByTestId('mock-delete-video'));

      expect(onVideoDeleted).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(screen.queryByTestId('mock-video-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('Modal download status', () => {
    test('reports an audio-only download as downloaded when opened from history', async () => {
      const user = userEvent.setup();
      const job = makeMultiVideoJob('job-audio', [
        makeVideo({
          id: 7,
          youtubeId: 'mp3only1',
          youTubeVideoName: 'Audio Only Video',
          filePath: null,
          audioFilePath: '/library/Channel/Audio Only Video.mp3',
          removed: false,
        }),
        makeVideo({ id: 8, youtubeId: 'other1', youTubeVideoName: 'Other Video' }),
      ]);

      render(
        <DownloadHistory
          {...defaultProps}
          jobs={[job]}
          expanded={{ 'job-audio': true }}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Audio Only Video' }));

      // Exact match: 'never_downloaded' also contains the substring 'downloaded'
      expect(screen.getByTestId('mock-video-status')).toHaveTextContent(/^downloaded$/);
    });
  });

  describe('Failed download indicators', () => {
    const adviceMessage =
      'Re-export fresh cookies from your browser and upload them in Settings -> Cookies.';

    function makeFailedJob(overrides: Partial<Job> = {}): Job {
      return {
        id: 'job-failed',
        jobType: 'Channel Downloads',
        status: 'Complete with Warnings',
        output: '',
        timeCreated: new Date('2024-01-15T09:00:00Z').getTime(),
        timeInitiated: new Date('2024-01-15T09:00:30Z').getTime(),
        data: {
          videos: [],
          failedVideos: [
            {
              youtubeId: 'fail0000001',
              title: 'Broken Video',
              channel: 'StarTalk',
              error: 'unable to download video data: HTTP Error 403: Forbidden',
              diagnosisKey: 'http-403-cookies-enabled',
            },
          ],
          diagnoses: [
            {
              key: 'http-403-cookies-enabled',
              title: 'YouTube blocked the download while using your cookies',
              message: adviceMessage,
              count: 1,
            },
          ],
        },
        ...overrides,
      };
    }

    test('shows failed-only jobs by default with a failed chip', () => {
      render(<DownloadHistory {...defaultProps} jobs={[makeFailedJob()]} />);

      expect(screen.getByText('1 failed')).toBeInTheDocument();
      expect(screen.queryByText('No jobs currently running')).not.toBeInTheDocument();
    });

    test('excludes failures handed to auto-retry from the chip count', () => {
      const job = makeFailedJob();
      job.data.failedVideos = [
        ...(job.data.failedVideos || []),
        {
          youtubeId: 'fail0000002',
          error: 'HTTP Error 403: Forbidden',
          autoRetryQueued: true,
        },
      ];

      render(<DownloadHistory {...defaultProps} jobs={[job]} />);

      expect(screen.getByText('1 failed')).toBeInTheDocument();
    });

    test('hides jobs whose failures were all handed to auto-retry', () => {
      const job = makeFailedJob();
      job.data.failedVideos = [
        {
          youtubeId: 'fail0000002',
          error: 'HTTP Error 403: Forbidden',
          autoRetryQueued: true,
        },
      ];
      job.data.diagnoses = [];

      render(<DownloadHistory {...defaultProps} jobs={[job]} />);

      expect(screen.getByText('No jobs currently running')).toBeInTheDocument();
    });

    test('shows the diagnosis title in the chip tooltip', async () => {
      const user = userEvent.setup();
      render(<DownloadHistory {...defaultProps} jobs={[makeFailedJob()]} />);

      await user.hover(screen.getByText('1 failed'));

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent(
        'YouTube blocked the download while using your cookies'
      );
    });

    test('expanded row shows the advice once with the failed video title', () => {
      render(
        <DownloadHistory
          {...defaultProps}
          jobs={[makeFailedJob()]}
          expanded={{ 'job-failed': true }}
        />
      );

      expect(screen.getAllByText(adviceMessage)).toHaveLength(1);
      expect(screen.getByText(/Broken Video/)).toBeInTheDocument();
    });

    test('shows the raw error for undiagnosed failures in the expanded row', () => {
      const job = makeFailedJob();
      job.data.failedVideos = [
        {
          youtubeId: 'fail0000001',
          title: 'Broken Video',
          error: 'Postprocessing failed with exit code 1',
        },
      ];
      job.data.diagnoses = [];

      render(
        <DownloadHistory
          {...defaultProps}
          jobs={[job]}
          expanded={{ 'job-failed': true }}
        />
      );

      expect(screen.getByText(/Postprocessing failed with exit code 1/)).toBeInTheDocument();
    });

    test('labels auto-retry jobs with a clean label instead of the raw job type', () => {
      const job = makeFailedJob({ jobType: 'Auto-retry: 1 video (HTTP 403)' });

      render(<DownloadHistory {...defaultProps} jobs={[job]} />);

      expect(screen.getAllByText('Auto-retry').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText('Auto-retry: 1 video (HTTP 403)')).not.toBeInTheDocument();
    });

    test('mobile card shows the failed chip and expanded advice', () => {
      render(
        <DownloadHistory
          {...defaultProps}
          jobs={[makeFailedJob()]}
          expanded={{ 'job-failed': true }}
          isMobile={true}
        />
      );

      expect(screen.getByText('1 failed')).toBeInTheDocument();
      expect(screen.getByText(adviceMessage)).toBeInTheDocument();
    });
  });
});
