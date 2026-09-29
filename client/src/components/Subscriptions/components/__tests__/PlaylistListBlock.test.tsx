import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom';
import PlaylistListBlock from '../PlaylistListBlock';
import { Playlist } from '../../../../types/playlist';

let mockIsMobile = false;
jest.mock('../../../../hooks/useMediaQuery', () => ({
  useMediaQuery: () => mockIsMobile,
}));

beforeEach(() => {
  mockIsMobile = false;
});

// Count cells show a bare number with a screen-reader-only unit, so match the
// element whose full text is the number and unit together.
const byFullText = (text: string) => (_content: string, element: Element | null) =>
  element?.textContent === text && element.tagName !== 'SPAN';

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
  sort_order: 'default',
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
          element={<PlaylistListBlock playlists={playlists} total={playlists.length} loading={false} onDelete={onDelete} />}
        />
        <Route path="/playlist/:id" element={<div data-testid="playlist-page">navigated</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('PlaylistListBlock auto-download indicator', () => {
  test('shows no auto-download chip when auto-download is disabled', () => {
    renderBlock([basePlaylist]);

    expect(screen.queryByRole('img', { name: 'Auto-download on' })).not.toBeInTheDocument();
  });

  test('tells screen readers when auto-download is disabled', () => {
    renderBlock([basePlaylist]);

    expect(screen.getByText('Auto-download off')).toBeInTheDocument();
  });

  test('shows an auto-download chip when auto-download is enabled', () => {
    renderBlock([{ ...basePlaylist, auto_download: true }]);

    expect(screen.getByRole('img', { name: 'Auto-download on' })).toHaveTextContent('Auto-download');
  });

  test('marks only the playlists with auto-download enabled', () => {
    renderBlock([
      basePlaylist,
      { ...basePlaylist, id: 2, playlist_id: 'PL2', auto_download: true },
    ]);

    expect(screen.getAllByRole('img', { name: 'Auto-download on' })).toHaveLength(1);
  });
});

describe('PlaylistListBlock desktop columns', () => {
  test('orders the columns Playlist, Downloaded, Total Videos, Auto-download', () => {
    renderBlock([basePlaylist]);

    const labels = screen.getAllByText(/^(Playlist|Downloaded|Total Videos|Auto-download)$/);
    expect(labels.map((label) => label.textContent)).toEqual([
      'Playlist', 'Downloaded', 'Total Videos', 'Auto-download',
    ]);
  });

  test('shows the downloaded count with its percent of the total', () => {
    renderBlock([{ ...basePlaylist, downloaded_count: 21 }]);

    expect(screen.getByText(byFullText('21 (50%) downloaded'))).toBeInTheDocument();
  });

  test('shows the total in its own column', () => {
    renderBlock([{ ...basePlaylist, downloaded_count: 7 }]);

    expect(screen.getByText(byFullText('42 videos'))).toBeInTheDocument();
  });

  test('shows a dash when the downloaded count is unknown', () => {
    renderBlock([basePlaylist]);

    expect(screen.getByText(byFullText('- downloaded'))).toBeInTheDocument();
  });

  test('marks a playlist at the 5,000 video limit as possibly larger', () => {
    renderBlock([{ ...basePlaylist, video_count: 5000, downloaded_count: 0 }]);

    expect(screen.getByText(byFullText('5,000+ videos'))).toBeInTheDocument();
  });

  test('leaves out the percent at the 5,000 video limit', () => {
    renderBlock([{ ...basePlaylist, video_count: 5000, downloaded_count: 0 }]);

    expect(screen.getByText(byFullText('0 downloaded'))).toBeInTheDocument();
  });

  test('puts the counts explanation in the Downloaded column header only', () => {
    renderBlock([basePlaylist]);

    expect(screen.getAllByRole('button', { name: 'Playlist video count info' })).toHaveLength(1);
  });

  test('labels the auto-download chip in full', () => {
    renderBlock([{ ...basePlaylist, auto_download: true }]);

    expect(screen.getByRole('img', { name: 'Auto-download on' })).toHaveTextContent('Auto-download');
  });
});

describe('PlaylistListBlock mobile layout', () => {
  beforeEach(() => {
    mockIsMobile = true;
  });

  test('shows the downloaded count and percent before the total', () => {
    renderBlock([{ ...basePlaylist, downloaded_count: 21 }]);

    expect(screen.getByText('21 downloaded (50%)')).toBeInTheDocument();
    expect(screen.getByText('• 42 videos')).toBeInTheDocument();
  });

  test('has no column headers', () => {
    renderBlock([basePlaylist]);

    expect(screen.queryByText('Total Videos')).not.toBeInTheDocument();
  });

  test('puts the counts explanation beside the playlist total', () => {
    renderBlock([basePlaylist]);

    expect(screen.getByRole('button', { name: 'Playlist video count info' })).toBeInTheDocument();
  });

  test('shortens the auto-download chip label', () => {
    renderBlock([{ ...basePlaylist, auto_download: true }]);

    expect(screen.getByRole('img', { name: 'Auto-download on' })).toHaveTextContent(/^Auto$/);
  });
});

describe('PlaylistListBlock total', () => {
  test('shows the playlist total', () => {
    renderBlock([basePlaylist]);

    expect(screen.getByText('Total playlists: 1')).toBeInTheDocument();
  });
});

describe('PlaylistListBlock download format indicator', () => {
  test('shows the MP3 indicator for an MP3 Only playlist', () => {
    renderBlock([{ ...basePlaylist, audio_format: 'mp3_only' }]);

    expect(screen.getByRole('img', { name: 'MP3 only downloads' })).toBeInTheDocument();
  });

  test('shows no format indicator for a video-only playlist', () => {
    renderBlock([basePlaylist]);

    expect(screen.queryByTestId('download-format-config-indicator')).not.toBeInTheDocument();
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
