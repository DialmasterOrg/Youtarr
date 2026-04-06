import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ImportProgress from '../components/ImportProgress';
import { ImportJobDetail } from '../../../types/subscriptionImport';

function makeJobDetail(overrides: Partial<ImportJobDetail> = {}): ImportJobDetail {
  return {
    jobId: 'job-1',
    status: 'In Progress',
    total: 10,
    done: 4,
    errors: 0,
    startedAt: '2026-01-01T00:00:00Z',
    results: [],
    ...overrides,
  };
}

describe('ImportProgress', () => {
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows progress bar with correct percentage', () => {
    const jobDetail = makeJobDetail({ total: 10, done: 4 });

    render(<ImportProgress jobDetail={jobDetail} onCancel={mockOnCancel} />);

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText('40% complete')).toBeInTheDocument();
    expect(screen.getByText('Importing 4 of 10 channels...')).toBeInTheDocument();
  });

  test('shows per-channel status items', () => {
    const jobDetail = makeJobDetail({
      total: 4,
      done: 3,
      errors: 1,
      results: [
        { channelId: 'ch1', title: 'Success Channel', state: 'success' },
        { channelId: 'ch2', title: 'Error Channel', state: 'error', error: 'Network error', details: 'Timeout' },
        { channelId: 'ch3', title: 'Skipped Channel', state: 'skipped', reason: 'Already subscribed' },
        { channelId: 'ch4', title: 'Pending Channel', state: 'pending' },
      ],
    });

    render(<ImportProgress jobDetail={jobDetail} onCancel={mockOnCancel} />);

    expect(screen.getByText('Success Channel')).toBeInTheDocument();
    expect(screen.getByText('Error Channel')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByText('Skipped Channel')).toBeInTheDocument();
    expect(screen.getByText('Already subscribed')).toBeInTheDocument();
    expect(screen.getByText('Pending Channel')).toBeInTheDocument();
  });

  test('cancel button calls onCancel', () => {
    const jobDetail = makeJobDetail();

    render(<ImportProgress jobDetail={jobDetail} onCancel={mockOnCancel} />);

    const cancelButton = screen.getByRole('button', { name: /cancel import/i });
    fireEvent.click(cancelButton);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  test('shows final status text when job is complete and hides cancel button', () => {
    const jobDetail = makeJobDetail({ status: 'Complete', done: 10, total: 10 });

    render(<ImportProgress jobDetail={jobDetail} onCancel={mockOnCancel} />);

    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel import/i })).not.toBeInTheDocument();
  });

  test('shows final status text for cancelled job', () => {
    const jobDetail = makeJobDetail({ status: 'Cancelled', done: 3, total: 10 });

    render(<ImportProgress jobDetail={jobDetail} onCancel={mockOnCancel} />);

    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel import/i })).not.toBeInTheDocument();
  });

  test('error details can be expanded', () => {
    const jobDetail = makeJobDetail({
      results: [
        { channelId: 'ch1', title: 'Error Channel', state: 'error', error: 'Failed', details: 'Detailed stack trace' },
      ],
    });

    render(<ImportProgress jobDetail={jobDetail} onCancel={mockOnCancel} />);

    // Details should be collapsed initially
    expect(screen.queryByText('Detailed stack trace')).not.toBeVisible();

    // Expand details
    const expandButton = screen.getByRole('button', { name: /expand details/i });
    fireEvent.click(expandButton);

    expect(screen.getByText('Detailed stack trace')).toBeVisible();
  });

  test('shows indeterminate progress when total is 0', () => {
    const jobDetail = makeJobDetail({ total: 0, done: 0 });

    render(<ImportProgress jobDetail={jobDetail} onCancel={mockOnCancel} />);

    const progressBar = screen.getByRole('progressbar');
    // Indeterminate progress bars don't have aria-valuenow
    expect(progressBar).not.toHaveAttribute('aria-valuenow');
  });
});
