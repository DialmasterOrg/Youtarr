import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ImportSummary from '../components/ImportSummary';
import { ImportJobDetail } from '../../../types/subscriptionImport';

function makeJobDetail(overrides: Partial<ImportJobDetail> = {}): ImportJobDetail {
  return {
    jobId: 'job-1',
    status: 'Complete',
    total: 5,
    done: 5,
    errors: 0,
    startedAt: '2026-01-01T00:00:00Z',
    results: [],
    ...overrides,
  };
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('ImportSummary', () => {
  test('shows correct counts', () => {
    const jobDetail = makeJobDetail({
      results: [
        { channelId: 'ch1', title: 'Channel 1', state: 'success' },
        { channelId: 'ch2', title: 'Channel 2', state: 'success' },
        { channelId: 'ch3', title: 'Channel 3', state: 'error', error: 'Failed' },
        { channelId: 'ch4', title: 'Channel 4', state: 'skipped', reason: 'Exists' },
      ],
    });

    renderWithRouter(<ImportSummary jobDetail={jobDetail} />);

    expect(screen.getByText('2 imported, 1 errors, 1 skipped')).toBeInTheDocument();
  });

  test('shows error details for errored channels', () => {
    const jobDetail = makeJobDetail({
      errors: 1,
      results: [
        { channelId: 'ch1', title: 'Bad Channel', state: 'error', error: 'Network timeout', details: 'Connection refused' },
      ],
    });

    renderWithRouter(<ImportSummary jobDetail={jobDetail} />);

    expect(screen.getByText('Failed Channels')).toBeInTheDocument();
    expect(screen.getByText('Bad Channel')).toBeInTheDocument();
    expect(screen.getByText('Network timeout')).toBeInTheDocument();

    // Expand details
    const expandButton = screen.getByRole('button', { name: /expand details/i });
    fireEvent.click(expandButton);

    expect(screen.getByText('Connection refused')).toBeVisible();
  });

  test('shows "Back to channels" link', () => {
    const jobDetail = makeJobDetail();

    renderWithRouter(<ImportSummary jobDetail={jobDetail} />);

    const link = screen.getByRole('link', { name: /back to channels/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/subscriptions');
  });

  test('shows cancelled notice when status is Cancelled', () => {
    const jobDetail = makeJobDetail({ status: 'Cancelled' });

    renderWithRouter(<ImportSummary jobDetail={jobDetail} />);

    expect(screen.getByText('Import was cancelled.')).toBeInTheDocument();
    expect(screen.getByText('Import Cancelled')).toBeInTheDocument();
  });

  test('does not show cancelled notice for completed jobs', () => {
    const jobDetail = makeJobDetail({ status: 'Complete' });

    renderWithRouter(<ImportSummary jobDetail={jobDetail} />);

    expect(screen.queryByText('Import was cancelled.')).not.toBeInTheDocument();
    expect(screen.getByText('Import Complete')).toBeInTheDocument();
  });

  test('does not show failed channels section when there are no errors', () => {
    const jobDetail = makeJobDetail({
      results: [
        { channelId: 'ch1', title: 'Channel 1', state: 'success' },
      ],
    });

    renderWithRouter(<ImportSummary jobDetail={jobDetail} />);

    expect(screen.queryByText('Failed Channels')).not.toBeInTheDocument();
  });
});
