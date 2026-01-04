import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DownloadHistory from '../DownloadHistory';
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

describe('DownloadHistory', () => {
  const mockHandleExpandCell = jest.fn();
  const mockSetAnchorEl = jest.fn();

  const defaultProps = {
    jobs: [],
    currentTime: new Date('2024-01-15T10:30:00Z'),
    expanded: {},
    anchorEl: {},
    handleExpandCell: mockHandleExpandCell,
    setAnchorEl: mockSetAnchorEl,
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

  test('displays video count and info button for jobs with videos', () => {
    // Create jobs that will all be displayed (with videos or in progress)
    const testJobs: Job[] = [
      sampleJobs[0], // Has 2 videos
      {
        ...sampleJobs[2], // In Progress job
        data: undefined as any, // Make data undefined so it shows
      },
    ];
    render(<DownloadHistory {...defaultProps} jobs={testJobs} />);

    // Job with videos should have info button
    const infoIcon = screen.queryByTestId('InfoIcon');
    expect(infoIcon).toBeInTheDocument();

    // Get all table cells
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

  test('handles popover interaction', async () => {
    const user = userEvent.setup();
    render(<DownloadHistory {...defaultProps} jobs={sampleJobs} />);

    // Find the info icon and its parent button
    const infoIcon = screen.getByTestId('InfoIcon');
    // Get the button containing the icon using Testing Library queries
    const buttons = screen.getAllByRole('button');
    const infoButton = buttons.find(btn => btn.contains(infoIcon));

    expect(infoButton).toBeTruthy();

    // Click the button and verify the handler was called
    await user.click(infoButton!);
    expect(mockSetAnchorEl).toHaveBeenCalled();
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
    const page2Button = screen.getByLabelText(/page 2/i);
    await user.click(page2Button);

    // Should now show remaining 3 jobs
    await waitFor(() => {
      const updatedRows = screen.getAllByRole('row');
      expect(updatedRows).toHaveLength(4); // 1 header + 3 jobs
    });
  });

  test('handles mobile view', () => {
    render(<DownloadHistory {...defaultProps} jobs={sampleJobs} isMobile={true} />);

    // Check that table cells are rendered (mobile affects styling, not structure)
    const tableCells = screen.getAllByRole('cell');
    expect(tableCells.length).toBeGreaterThan(0);
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
    const page2Button = screen.getByLabelText(/page 2/i);
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

  test('shows info button for jobs with videos', () => {
    const jobWithVideos: Job[] = [{
      id: 'job-videos',
      jobType: 'Channel Downloads',
      status: 'Completed',
      output: '',
      timeCreated: Date.now(),
      timeInitiated: Date.now(),
      data: {
        videos: [
          {
            id: 1,
            youtubeId: 'video1',
            youTubeChannelName: 'Test Channel',
            youTubeVideoName: 'Test Video',
            duration: 185,
            timeCreated: new Date().toISOString(),
            originalDate: null,
            description: null,
          } as VideoData,
        ],
      },
    }];

    render(<DownloadHistory {...defaultProps} jobs={jobWithVideos} />);

    // Check that info icon is shown for job with videos
    const infoIcon = screen.getByTestId('InfoIcon');
    expect(infoIcon).toBeInTheDocument();

    // Verify the job displays "1" for video count (not the actual popover content)
    const tableCells = screen.getAllByRole('cell');
    const cellTexts = tableCells.map(cell => cell.textContent || '');
    expect(cellTexts.some(text => text.includes('1'))).toBe(true); // 1 video
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
});