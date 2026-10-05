import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VideoEpisode } from '../../../../../types/titleShows';

const mockRefetch = jest.fn();
let mockData: VideoEpisode | null = null;
jest.mock('../../../EpisodeAssign/useVideoEpisode', () => ({
  useVideoEpisode: () => ({ data: mockData, loading: false, error: null, refetch: mockRefetch, assign: jest.fn() }),
}));
jest.mock('../../../EpisodeAssign/EpisodeAssignDialog', () => ({
  __esModule: true,
  default: function MockAssign(props: { open: boolean; onSaved?: () => void }) {
    const React = require('react');
    return props.open ? React.createElement('button', { 'data-testid': 'assign', onClick: () => props.onSaved?.() }, 'saved') : null;
  },
}));

import VideoEpisodeSection from '../VideoEpisodeSection';

const SHOWS = [{ id: 3, name: 'Beyblade', seasonNames: {} }];

describe('VideoEpisodeSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockData = null;
  });

  test('shows nothing for a channel without shows', () => {
    mockData = { channelId: 'UC1', assignable: false, classification: null, shows: [] };
    const { container } = render(<VideoEpisodeSection open token="token" youtubeId="abcdefghijk" title="T" />);
    expect(container).toBeEmptyDOMElement();
  });

  test('names the episode of a title show', () => {
    mockData = {
      channelId: 'UC1', assignable: true, shows: SHOWS,
      classification: { showId: 3, showName: 'Beyblade', kind: 'title', status: 'assigned', season: 1, episode: 20, code: 'S01E20', source: 'title', notAnEpisode: false },
    };
    render(<VideoEpisodeSection open token="token" youtubeId="abcdefghijk" title="T" />);
    expect(screen.getByText('S01E20 of Beyblade')).toBeInTheDocument();
  });

  test('says when a video is in no show', () => {
    mockData = { channelId: 'UC1', assignable: true, shows: SHOWS, classification: null };
    render(<VideoEpisodeSection open token="token" youtubeId="abcdefghijk" title="T" />);
    expect(screen.getByText('Not in a show')).toBeInTheDocument();
  });

  test('changes the episode and reloads it once saved', () => {
    mockData = { channelId: 'UC1', assignable: true, shows: SHOWS, classification: null };
    render(<VideoEpisodeSection open token="token" youtubeId="abcdefghijk" title="T" />);
    fireEvent.click(screen.getByRole('button', { name: 'Change episode...' }));
    fireEvent.click(screen.getByTestId('assign'));
    expect(mockRefetch).toHaveBeenCalled();
  });

  test('tells its page the episode changed once saved', () => {
    mockData = { channelId: 'UC1', assignable: true, shows: SHOWS, classification: null };
    const onChanged = jest.fn();
    render(<VideoEpisodeSection open token="token" youtubeId="abcdefghijk" title="T" onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change episode...' }));
    fireEvent.click(screen.getByTestId('assign'));
    expect(onChanged).toHaveBeenCalledWith('abcdefghijk');
  });
});
