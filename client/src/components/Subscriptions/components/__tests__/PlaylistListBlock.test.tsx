import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom';
import PlaylistListBlock from '../PlaylistListBlock';
import { Playlist } from '../../../../types/playlist';

const basePlaylist: Playlist = {
  id: 1,
  playlist_id: 'PL1',
  title: 'My Playlist',
  url: 'https://youtube.com/playlist?list=PL1',
  description: null,
  uploader: 'Owner',
  thumbnail: null,
  video_count: 42,
  enabled: true,
  auto_download: false,
  sync_to_plex: false,
  sync_to_jellyfin: false,
  sync_to_emby: false,
  public_on_servers: false,
  default_sub_folder: null,
  video_quality: null,
  min_duration: null,
  max_duration: null,
  title_filter_regex: null,
  audio_format: null,
  default_rating: null,
  lastFetched: null,
};

const renderBlock = (playlists: Playlist[], onDelete: jest.Mock = jest.fn()) =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={<PlaylistListBlock playlists={playlists} loading={false} onDelete={onDelete} />}
        />
        <Route path="/playlist/:id" element={<div data-testid="playlist-page">navigated</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('PlaylistListBlock auto-download indicator', () => {
  test('shows an "off" indicator when auto-download is disabled', () => {
    renderBlock([basePlaylist]);

    expect(screen.getByLabelText('Auto-download off')).toBeInTheDocument();
    expect(screen.queryByLabelText('Auto-download on')).not.toBeInTheDocument();
  });

  test('shows an "on" indicator when auto-download is enabled', () => {
    renderBlock([{ ...basePlaylist, auto_download: true }]);

    expect(screen.getByLabelText('Auto-download on')).toBeInTheDocument();
    expect(screen.queryByLabelText('Auto-download off')).not.toBeInTheDocument();
  });

  test('renders one indicator per playlist', () => {
    renderBlock([
      basePlaylist,
      { ...basePlaylist, id: 2, playlist_id: 'PL2', auto_download: true },
    ]);

    expect(screen.getByLabelText('Auto-download off')).toBeInTheDocument();
    expect(screen.getByLabelText('Auto-download on')).toBeInTheDocument();
  });
});

describe('PlaylistListBlock remove button', () => {
  test('renders a remove button for each playlist', () => {
    renderBlock([
      basePlaylist,
      { ...basePlaylist, id: 2, playlist_id: 'PL2' },
    ]);

    expect(screen.getAllByRole('button', { name: 'Remove playlist' })).toHaveLength(2);
  });

  test('clicking remove calls onDelete with the playlist without navigating', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    renderBlock([basePlaylist], onDelete);

    await user.click(screen.getByRole('button', { name: 'Remove playlist' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ playlist_id: 'PL1' }));
    expect(screen.queryByTestId('playlist-page')).not.toBeInTheDocument();
  });

  test('clicking the row still navigates to the playlist page', async () => {
    const user = userEvent.setup();
    renderBlock([basePlaylist]);

    await user.click(screen.getByText('My Playlist'));

    expect(await screen.findByTestId('playlist-page')).toBeInTheDocument();
  });
});
