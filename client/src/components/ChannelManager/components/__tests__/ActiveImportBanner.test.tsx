import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActiveImportBanner from '../ActiveImportBanner';
import { renderWithProviders } from '../../../../test-utils';
import { ImportJobSummary } from '../../../../types/subscriptionImport';

const makeImport = (overrides: Partial<ImportJobSummary> = {}): ImportJobSummary => ({
  jobId: 'job-1',
  status: 'In Progress',
  total: 10,
  done: 3,
  errors: 0,
  startedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('ActiveImportBanner', () => {
  test('renders nothing when activeImport is null', () => {
    renderWithProviders(
      <ActiveImportBanner activeImport={null} />
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('shows progress text when import is in progress', () => {
    renderWithProviders(
      <ActiveImportBanner activeImport={makeImport({ done: 3, total: 10 })} />
    );

    expect(screen.getByText('Importing channels: 3 of 10...')).toBeInTheDocument();
  });

  test('shows "View details" link', () => {
    renderWithProviders(
      <ActiveImportBanner activeImport={makeImport()} />
    );

    const link = screen.getByRole('link', { name: 'View details' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/channels/import');
  });

  test('shows success message when import is complete', () => {
    renderWithProviders(
      <ActiveImportBanner activeImport={makeImport({ status: 'Complete', done: 10, total: 10 })} />
    );

    expect(screen.getByText('Import complete! 10 channels imported.')).toBeInTheDocument();
  });

  test('shows progress bar when import is in progress', () => {
    renderWithProviders(
      <ActiveImportBanner activeImport={makeImport({ done: 5, total: 10 })} />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('does not show progress bar when import is complete', () => {
    renderWithProviders(
      <ActiveImportBanner activeImport={makeImport({ status: 'Complete', done: 10, total: 10 })} />
    );

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
