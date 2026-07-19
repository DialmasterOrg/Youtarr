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

  test('labels the chip element itself so it aligns as a flex item', () => {
    render(<WatchedChip watchedBy={['plex']} />);
    // An inline wrapper between the flex row and the chip baseline-shifts the
    // chip downward relative to sibling chips, so the label must sit on the chip.
    expect(screen.getByLabelText('Watched on Plex')).toBe(
      screen.getByTestId('watched-chip')
    );
  });

  test('applies compact styling when compact prop is true', () => {
    render(<WatchedChip watchedBy={['plex']} compact />);
    expect(screen.getByTestId('watched-chip')).toHaveStyle({
      height: '20px',
      fontSize: '0.65rem',
    });
  });
});
