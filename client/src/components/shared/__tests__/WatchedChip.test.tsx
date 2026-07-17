import React from 'react';
import { render, screen } from '@testing-library/react';
import WatchedChip from '../WatchedChip';

describe('WatchedChip', () => {
  test('renders nothing when watchedBy is empty', () => {
    render(<WatchedChip watchedBy={[]} />);
    expect(screen.queryByText('Watched')).not.toBeInTheDocument();
  });

  test('renders a Watched chip when watched on a server', () => {
    render(<WatchedChip watchedBy={['plex']} />);
    expect(screen.getByText('Watched')).toBeInTheDocument();
  });

  test('exposes the watched servers via the accessible label', () => {
    render(<WatchedChip watchedBy={['plex', 'jellyfin']} />);
    expect(screen.getByLabelText('Watched on Plex, Jellyfin')).toBeInTheDocument();
  });
});
