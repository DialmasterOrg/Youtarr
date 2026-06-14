import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

const renderBlock = (playlists: Playlist[]) =>
  render(
    <MemoryRouter>
      <PlaylistListBlock playlists={playlists} loading={false} />
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
