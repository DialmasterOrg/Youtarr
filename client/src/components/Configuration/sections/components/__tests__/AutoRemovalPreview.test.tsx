import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AutoRemovalPreview } from '../AutoRemovalPreview';
import { renderWithProviders } from '../../../../../test-utils';
import { AutoRemovalDryRunResult } from '../../../types';

const createResult = (
  overrides: Partial<AutoRemovalDryRunResult> = {}
): AutoRemovalDryRunResult => ({
  dryRun: true,
  success: true,
  errors: [],
  plan: {
    ageStrategy: {
      enabled: true,
      thresholdDays: 30,
      candidateCount: 2,
      estimatedFreedBytes: 2097152,
      deletedCount: 0,
      failedCount: 0,
      sampleVideos: [
        {
          id: 1,
          youtubeId: 'abc123',
          title: 'Old Video',
          channel: 'Example Channel',
          fileSize: 1048576,
          timeCreated: '2026-01-01T00:00:00Z',
        },
      ],
    },
    watchedStrategy: {
      enabled: true,
      minDaysSinceWatched: 7,
      minVideoAgeDays: 0,
      candidateCount: 3,
      estimatedFreedBytes: 3145728,
      deletedCount: 0,
      failedCount: 0,
      sampleVideos: [
        {
          id: 2,
          youtubeId: 'def456',
          title: 'Watched Video',
          channel: 'Example Channel',
          fileSize: 1048576,
          timeCreated: '2026-02-01T00:00:00Z',
        },
      ],
    },
    keepRecent: {
      count: 5,
      protectedCount: 5,
    },
    spaceStrategy: {
      enabled: true,
      threshold: '10GB',
      thresholdBytes: 10 * 1024 * 1024 * 1024,
      candidateCount: 0,
      estimatedFreedBytes: 0,
      deletedCount: 0,
      failedCount: 0,
      needsCleanup: false,
      sampleVideos: [],
    },
  },
  simulationTotals: {
    byAge: 2,
    byWatched: 3,
    bySpace: 0,
    total: 5,
    estimatedFreedBytes: 5242880,
  },
  ...overrides,
});

describe('AutoRemovalPreview', () => {
  test('renders the total summary', () => {
    renderWithProviders(<AutoRemovalPreview result={createResult()} />);

    expect(screen.getByText('Preview Summary')).toBeInTheDocument();
    expect(screen.getByText(/Would remove/i)).toHaveTextContent(
      'Would remove 5 videos (~5.00 MB).'
    );
  });

  test('renders per-strategy lines including the watched strategy', () => {
    renderWithProviders(<AutoRemovalPreview result={createResult()} />);

    expect(screen.getByText(/Age threshold: 2 videos/i)).toBeInTheDocument();
    expect(screen.getByText(/Watched: 3 videos/i)).toBeInTheDocument();
  });

  test('renders the keep-recent protection note', () => {
    renderWithProviders(<AutoRemovalPreview result={createResult()} />);

    expect(
      screen.getByText(/5 most recent downloads are protected/i)
    ).toBeInTheDocument();
  });

  test('renders sample videos from all strategies', () => {
    renderWithProviders(<AutoRemovalPreview result={createResult()} />);

    expect(screen.getByText(/Old Video/)).toBeInTheDocument();
    expect(screen.getByText(/Watched Video/)).toBeInTheDocument();
  });

  test('notes when storage is above the free space threshold', () => {
    renderWithProviders(<AutoRemovalPreview result={createResult()} />);

    expect(
      screen.getByText(/Storage is currently above the free space threshold/i)
    ).toBeInTheDocument();
  });

  test('renders the watched strategy skip reason when the strategy was skipped', () => {
    const result = createResult();
    result.plan.watchedStrategy = {
      ...result.plan.watchedStrategy!,
      enabled: false,
      candidateCount: 0,
      skippedReason: 'Watched-based cleanup skipped: watch status sync is disabled',
    };
    renderWithProviders(<AutoRemovalPreview result={result} />);

    expect(
      screen.getByText(/watch status sync is disabled/i)
    ).toBeInTheDocument();
  });

  test('renders warnings when the result has errors', () => {
    const result = createResult({
      errors: ['Watched-based cleanup skipped: watch status sync is disabled'],
    });
    renderWithProviders(<AutoRemovalPreview result={result} />);

    expect(screen.getByText('Warnings')).toBeInTheDocument();
    expect(
      screen.getByText(/watch status sync is disabled/i)
    ).toBeInTheDocument();
  });

  test('handles results without watched or keep-recent data', () => {
    const result = createResult();
    delete result.plan.watchedStrategy;
    delete result.plan.keepRecent;
    renderWithProviders(<AutoRemovalPreview result={result} />);

    expect(screen.getByText('Preview Summary')).toBeInTheDocument();
    expect(screen.queryByText(/Watched:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/most recent downloads are protected/i)).not.toBeInTheDocument();
  });
});
