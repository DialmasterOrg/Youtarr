import React from 'react';
import { render, screen } from '@testing-library/react';
import VideoWatchStatusSection from '../VideoWatchStatusSection';
import { ServerWatchStatus } from '../../hooks/useWatchStatus';

const base: ServerWatchStatus = {
  server: 'plex',
  serverUserId: '1',
  userName: null,
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

  test('groups rows by server and lists the users who watched', () => {
    render(
      <VideoWatchStatusSection
        statuses={[
          { ...base, played: true, percentWatched: 100, lastWatchedAt: '2026-07-10T12:00:00Z' },
          {
            ...base,
            serverUserId: '55',
            userName: 'kid1',
            played: true,
            percentWatched: 100,
            lastWatchedAt: '2026-07-12T12:00:00Z',
          },
          { ...base, serverUserId: '56', userName: 'kid2', played: false },
        ]}
      />
    );
    // One aggregated Plex line: the NEWEST watched date (7/12, not the owner's
    // 7/10), and only played users named.
    expect(screen.getAllByText('Plex')).toHaveLength(1);
    const newestDate = new Date('2026-07-12T12:00:00Z').toLocaleDateString();
    expect(screen.getByText(`Watched ${newestDate} by kid1`)).toBeInTheDocument();
  });

  test('shows the furthest in-progress position across users', () => {
    render(
      <VideoWatchStatusSection
        statuses={[
          { ...base, server: 'jellyfin', serverUserId: 'u1', percentWatched: 20 },
          { ...base, server: 'jellyfin', serverUserId: 'u2', percentWatched: 70 },
        ]}
      />
    );
    expect(screen.getByText('In progress (70%)')).toBeInTheDocument();
    expect(screen.queryByText('In progress (20%)')).not.toBeInTheDocument();
  });

  test('watched users without stored names fall back to the plain status', () => {
    render(
      <VideoWatchStatusSection
        statuses={[
          { ...base, played: true, percentWatched: 100, lastWatchedAt: '2026-07-10T12:00:00Z' },
          { ...base, serverUserId: '2', played: true, percentWatched: 100, lastWatchedAt: null },
        ]}
      />
    );
    expect(screen.getByText(/^Watched [^b]*$/)).toBeInTheDocument();
  });

  test('an in-progress user does not override another user having watched', () => {
    render(
      <VideoWatchStatusSection
        statuses={[
          { ...base, serverUserId: '55', userName: 'kid1', played: true, percentWatched: 100 },
          { ...base, percentWatched: 40 },
        ]}
      />
    );
    expect(screen.getByText(/Watched by kid1/)).toBeInTheDocument();
    expect(screen.queryByText(/In progress/)).not.toBeInTheDocument();
  });
});
