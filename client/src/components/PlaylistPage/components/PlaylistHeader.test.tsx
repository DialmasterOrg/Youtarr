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
    expect(screen.getByRole('button', { name: /Download all 37 videos/i })).toBeInTheDocument();
  });

  test('links to the playlist on YouTube', () => {
    render(
      <MemoryRouter>
        <PlaylistHeader {...baseProps} />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'Open in YouTube' })).toHaveAttribute(
      'href',
      'https://www.youtube.com/playlist?list=PL1'
    );
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
  test.each([
    [true, 'Following new additions.'],
    [false, 'Following paused. Resume to catch up on new additions.'],
  ] as const)('shows the following status when auto-download is %s', (autoDownload, status) => {
    render(<MemoryRouter><PlaylistHeader {...baseProps}
      playlist={{ ...playlist, auto_download: autoDownload, auto_download_baseline_at: '2026-09-01T00:00:00Z' }}
      followingExistingCount={3} /></MemoryRouter>);
    expect(screen.getByText(status, { exact: false })).toBeVisible();
    expect(screen.getByText(/3 older/)).toBeVisible();
  });

  test('does not claim to follow a playlist before setup', () => {
    render(<MemoryRouter><PlaylistHeader {...baseProps} /></MemoryRouter>);
    expect(screen.queryByText(/Following new additions/)).not.toBeInTheDocument();
  });

  test.each([false, true])('shows outstanding selections on desktop and mobile (mobile=%s)', (isMobile) => {
    render(<MemoryRouter><PlaylistHeader {...baseProps} isMobile={isMobile} followingRequestedCount={8}
      playlist={{ ...playlist, auto_download_baseline_at: '2026-09-01T00:00:00Z' }} /></MemoryRouter>);
    expect(screen.getByText(/8 selected videos are not downloaded yet/)).toBeVisible();
  });

  test.each([false, true])('shows a persisted setup failure in the header (mobile=%s)', (isMobile) => {
    render(<MemoryRouter><PlaylistHeader {...baseProps} isMobile={isMobile}
      playlist={{ ...playlist, auto_download: false, auto_download_setup_error: 'PLAYLIST_TOO_LARGE' }} /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('Auto-download is off');
    expect(screen.getByRole('button', { name: 'Retry following setup' })).toBeEnabled();
  });

});
