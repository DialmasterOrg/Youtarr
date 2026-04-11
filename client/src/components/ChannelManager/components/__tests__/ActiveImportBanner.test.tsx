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

  test('shows warning alert when import is cancelled', () => {
    renderWithProviders(
      <ActiveImportBanner activeImport={makeImport({ status: 'Cancelled', done: 4, total: 10 })} />
    );

    expect(screen.getByText('Import cancelled (4 of 10 processed).')).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('MuiAlert-standardWarning');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  test('shows error alert when import has failed', () => {
    renderWithProviders(
      <ActiveImportBanner activeImport={makeImport({ status: 'Failed', done: 2, total: 10 })} />
    );

    expect(screen.getByText('Import failed (2 of 10 processed).')).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('MuiAlert-standardError');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  test('shows warning alert when import completes with warnings', () => {
    renderWithProviders(
      <ActiveImportBanner activeImport={makeImport({ status: 'Complete with Warnings', done: 8, total: 10 })} />
    );

    expect(screen.getByText('Import complete with warnings. 8 channels imported.')).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('MuiAlert-standardWarning');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  test('shows info alert when import is in progress', () => {
    renderWithProviders(
      <ActiveImportBanner activeImport={makeImport({ status: 'In Progress', done: 3, total: 10 })} />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('MuiAlert-standardInfo');
  });

  test('shows success alert when import is complete', () => {
    renderWithProviders(
      <ActiveImportBanner activeImport={makeImport({ status: 'Complete', done: 10, total: 10 })} />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('MuiAlert-standardSuccess');
  });
});
