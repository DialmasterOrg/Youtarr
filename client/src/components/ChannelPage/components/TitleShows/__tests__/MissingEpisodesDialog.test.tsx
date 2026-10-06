import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MissingEpisodes } from '../../../../../types/titleShows';

let mockState: { data: MissingEpisodes | null; loading: boolean; error: string | null };
jest.mock('../../../hooks/useMissingEpisodes', () => ({ useMissingEpisodes: () => mockState }));

import MissingEpisodesDialog from '../MissingEpisodesDialog';

const MISSING: MissingEpisodes = {
  showId: 3,
  name: 'Beyblade',
  seasons: [
    {
      season: 1, name: 'Beyblade', episodes: 3, downloaded: 1, gaps: [2], gapsTruncated: false,
      notDownloaded: [{ youtubeId: 'b', title: 'BEYBLADE EN Episode 3: Third', episode: 3, code: 'S01E03' }],
    },
    { season: 2, name: null, episodes: 2, downloaded: 2, gaps: [], gapsTruncated: false, notDownloaded: [] },
  ],
};

describe('MissingEpisodesDialog', () => {
  beforeEach(() => {
    mockState = { data: MISSING, loading: false, error: null };
  });

  const renderDialog = () => render(<MissingEpisodesDialog open token="token" channelId="UC1" showId={3} onClose={jest.fn()} />);

  test('summarizes each season', () => {
    renderDialog();
    expect(screen.getByText('Season 1, Beyblade: 1 of 3 downloaded')).toBeInTheDocument();
    expect(screen.getByText('Season 2: all 2 downloaded')).toBeInTheDocument();
  });

  test('lists the episodes not downloaded yet', () => {
    renderDialog();
    expect(screen.getByText('S01E03')).toBeInTheDocument();
    expect(screen.getByText('BEYBLADE EN Episode 3: Third')).toBeInTheDocument();
  });

  test('lists the numbers no known video holds', () => {
    renderDialog();
    expect(screen.getByText('No known video for E2.')).toBeInTheDocument();
  });

  test('reports a failed load', () => {
    mockState = { data: null, loading: false, error: 'Show not found' };
    renderDialog();
    expect(screen.getByText('Show not found')).toBeInTheDocument();
  });
});
