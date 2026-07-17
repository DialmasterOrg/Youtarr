import React from 'react';
import { render, screen } from '@testing-library/react';
import VideoWatchStatusSection from '../VideoWatchStatusSection';
import { ServerWatchStatus } from '../../hooks/useWatchStatus';

const base: ServerWatchStatus = {
  server: 'plex',
  played: false,
  playCount: 0,
  percentWatched: null,
  lastWatchedAt: null,
  lastSyncedAt: '2026-07-16T00:00:00Z',
};

describe('VideoWatchStatusSection', () => {
  test('renders nothing when there are no statuses', () => {
    render(<VideoWatchStatusSection statuses={[]} />);
    expect(screen.queryByText('Watch Status')).not.toBeInTheDocument();
  });

  test('shows Watched with date for a played video', () => {
    render(
      <VideoWatchStatusSection
        statuses={[{ ...base, played: true, percentWatched: 100, lastWatchedAt: '2026-07-10T12:00:00Z' }]}
      />
    );
    expect(screen.getByText('Watch Status')).toBeInTheDocument();
    expect(screen.getByText('Plex')).toBeInTheDocument();
    expect(screen.getByText(/^Watched/)).toBeInTheDocument();
  });

  test('shows in-progress percentage', () => {
    render(<VideoWatchStatusSection statuses={[{ ...base, server: 'jellyfin', percentWatched: 42.5 }]} />);
    expect(screen.getByText('Jellyfin')).toBeInTheDocument();
    expect(screen.getByText('In progress (43%)')).toBeInTheDocument();
  });

  test('shows Unwatched when never started', () => {
    render(<VideoWatchStatusSection statuses={[{ ...base, server: 'emby' }]} />);
    expect(screen.getByText('Emby')).toBeInTheDocument();
    expect(screen.getByText('Unwatched')).toBeInTheDocument();
  });
});
