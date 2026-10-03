import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import EpisodeChip from '../EpisodeChip';

const EPISODE = { showName: 'Mark Rober', season: 2024, episode: 3151200, code: 'S2024E03151200' };

describe('EpisodeChip', () => {
  test('shows the episode code', () => {
    render(<EpisodeChip episode={EPISODE} />);
    expect(screen.getByText('S2024E03151200')).toBeInTheDocument();
  });

  test('names the show for assistive technology', () => {
    render(<EpisodeChip episode={EPISODE} />);
    expect(screen.getByLabelText('TV episode Mark Rober, S2024E03151200')).toBeInTheDocument();
  });

  test('renders nothing for a video that is not an episode', () => {
    render(<EpisodeChip episode={null} />);
    expect(screen.queryByTestId('episode-chip')).not.toBeInTheDocument();
  });
});
