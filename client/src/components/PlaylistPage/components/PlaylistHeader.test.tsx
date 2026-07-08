import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import PlaylistHeader from './PlaylistHeader';
import { Playlist } from '../../../types/playlist';

const playlist = {
  playlist_id: 'PL1',
  title: 'Challenge Videos',
  uploader: 'PrestonPlayz',
  video_count: 39,
  lastFetched: null,
  thumbnail: null,
  auto_download: true,
  public_on_servers: false,
  sync_to_plex: true,
  sync_to_jellyfin: false,
  sync_to_emby: false,
} as unknown as Playlist;

const baseProps = {
  playlist,
  thumbnailUrl: '',
  isMobile: false,
  serverStatus: { plex: true, jellyfin: false, emby: false },
  anyConfigured: true,
  newCount: 37,
  togglePending: false,
  actionRunning: false,
  refreshing: false,
  onRefresh: jest.fn(),
  onDownloadAll: jest.fn(),
  onOpenSettings: jest.fn(),
  onToggleAutoDownload: jest.fn(),
  onToggleSync: jest.fn(),
  onChangePublic: jest.fn(),
  onSyncNow: jest.fn(),
  onRegenerateM3U: jest.fn(),
};

describe('PlaylistHeader', () => {
  test('renders title, both group labels, and the scoped download button', () => {
    render(
      <MemoryRouter>
        <PlaylistHeader {...baseProps} />
      </MemoryRouter>
    );
    expect(screen.getByText('Challenge Videos')).toBeInTheDocument();
    expect(screen.getByText(/Library & Downloads/i)).toBeInTheDocument();
    expect(screen.getByText(/Media Server Sync/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download 37 new/i })).toBeInTheDocument();
  });

  test('shows a Video playlist chip when the playlist is not MP3 Only', () => {
    render(
      <MemoryRouter>
        <PlaylistHeader {...baseProps} />
      </MemoryRouter>
    );
    expect(screen.getByText('Video playlist')).toBeInTheDocument();
  });

  test('shows an Audio playlist chip when the playlist is MP3 Only', () => {
    render(
      <MemoryRouter>
        <PlaylistHeader
          {...baseProps}
          playlist={{ ...playlist, audio_format: 'mp3_only' }}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('Audio playlist')).toBeInTheDocument();
  });

  test('forwards unsyncableCount to the media server sync group', () => {
    render(
      <MemoryRouter>
        <PlaylistHeader {...baseProps} unsyncableCount={2} />
      </MemoryRouter>
    );
    expect(screen.getByText(/2 downloaded items have no video file/i)).toBeInTheDocument();
  });
});
