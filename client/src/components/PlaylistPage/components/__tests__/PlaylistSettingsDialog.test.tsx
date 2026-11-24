import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlaylistSettingsDialog from '../PlaylistSettingsDialog';
import { Playlist } from '../../../../types/playlist';

// Lightweight stub: the real SubfolderAutocomplete relies on Radix portals.
// The stub exposes the current value and lets a test trigger a change.
jest.mock('../../../shared/SubfolderAutocomplete', () => ({
  __esModule: true,
  SubfolderAutocomplete: ({
    value,
    onChange,
  }: {
    value: string | null;
    onChange: (value: string | null) => void;
  }) => {
    const React = require('react');
    return React.createElement(
      'button',
      { 'data-testid': 'subfolder-mock', onClick: () => onChange('Kids') },
      `subfolder:${value ?? 'null'}`
    );
  },
}));

// Stable return references: these mirror the real hooks' memoized values.
// A fresh function/object per render would retrigger the dialog's open effect
// (refetchConfig is in its deps) and loop forever.
jest.mock('../../../../hooks/useSubfolders', () => {
  const value = { subfolders: [], loading: false, error: null, refetch: () => Promise.resolve(), createSubfolder: jest.fn(() => Promise.resolve()) };
  return { useSubfolders: () => value };
});

jest.mock('../../../../hooks/useConfig', () => {
  const refetch = () => Promise.resolve();
  const config = { defaultSubfolder: null };
  return { useConfig: () => ({ config, refetch }) };
});

// The filter preview is the only request the dialog makes itself.
const mockAxiosPost = jest.fn();
jest.mock('axios', () => ({
  post: (...args: unknown[]) => mockAxiosPost(...args),
  isAxiosError: jest.fn(() => false),
}));

let mockMutationsReturn: {
  updateSettings: jest.Mock;
  pending: boolean;
  error: string | null;
};

jest.mock('../../../../hooks/usePlaylistMutations', () => ({
  usePlaylistMutations: () => mockMutationsReturn,
}));

const basePlaylist: Playlist = {
  id: 1,
  playlist_id: 'PL123',
  title: 'My Playlist',
  url: 'https://youtube.com/playlist?list=PL123',
  description: null,
  uploader: null,
  thumbnail: null,
  video_count: 10,
  enabled: true,
  auto_download: true,
  sync_to_plex: true,
  sync_to_jellyfin: true,
  sync_to_emby: true,
  public_on_servers: false,
  sort_order: 'default',
  default_sub_folder: null,
  video_quality: '720',
  min_duration: 300,
  max_duration: 600,
  title_filter_regex: 'keepme',
  audio_format: null,
  default_rating: 'PG',
  lastFetched: null,
};

function setupDialog(overrides: Partial<React.ComponentProps<typeof PlaylistSettingsDialog>> = {}) {
  const props = {
    open: true,
    playlist: basePlaylist,
    token: 'tok',
    onClose: jest.fn(),
    onSaved: jest.fn(),
    ...overrides,
  };
  render(<PlaylistSettingsDialog {...props} />);
  return props;
}

describe('PlaylistSettingsDialog', () => {
  beforeEach(() => {
    mockMutationsReturn = {
      updateSettings: jest.fn().mockResolvedValue(true),
      pending: false,
      error: null,
    };
  });

  test('titles the dialog Playlist Settings', () => {
    setupDialog();
    expect(screen.getByText('Playlist Settings')).toBeInTheDocument();
  });

  test('renders dropdowns seeded from the playlist values', () => {
    setupDialog();
    expect(screen.getByLabelText('Video Quality')).toHaveTextContent('720p (HD)');
    expect(screen.getByLabelText('Download Type')).toHaveTextContent('Video Only (default)');
    expect(screen.getByLabelText('Default Rating')).toHaveTextContent('PG');
    expect(screen.getByLabelText('Playlist order')).toHaveTextContent('YouTube playlist order');
    expect(screen.getByTestId('subfolder-mock')).toHaveTextContent('subfolder:null');
  });

  test('saves the settings, without filters that were not edited, then closes', async () => {
    const props = setupDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockMutationsReturn.updateSettings).toHaveBeenCalledWith('PL123', {
        default_sub_folder: null,
        video_quality: '720',
        audio_format: null,
        default_rating: 'PG',
        sort_order: 'default',
      });
    });

    await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
    expect(props.onClose).toHaveBeenCalled();
  });

  describe('download filters', () => {
    const savedSettings = () => mockMutationsReturn.updateSettings.mock.calls[0][1];
    const save = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(mockMutationsReturn.updateSettings).toHaveBeenCalled());
    };

    test('shows the saved filters', () => {
      setupDialog();
      expect(screen.getByLabelText('Title Filter (Python Regex)')).toHaveValue('keepme');
      expect(screen.getByLabelText('Min Duration (mins)')).toHaveValue(5);
      expect(screen.getByLabelText('Max Duration (mins)')).toHaveValue(10);
    });

    test('saves an edited title filter', async () => {
      setupDialog();
      fireEvent.change(screen.getByLabelText('Title Filter (Python Regex)'), { target: { value: '(?i)full episode' } });
      await save();
      expect(savedSettings().title_filter_regex).toBe('(?i)full episode');
    });

    test('saves a title filter without surrounding spaces', async () => {
      setupDialog();
      fireEvent.change(screen.getByLabelText('Title Filter (Python Regex)'), { target: { value: '  Episode  ' } });
      await save();
      expect(savedSettings().title_filter_regex).toBe('Episode');
    });

    test.each(['', '   '])('saves a blank title filter %j as no filter', async (blank) => {
      setupDialog();
      fireEvent.change(screen.getByLabelText('Title Filter (Python Regex)'), { target: { value: blank } });
      await save();
      expect(savedSettings().title_filter_regex).toBeNull();
    });

    test('saves edited durations in seconds', async () => {
      setupDialog();
      fireEvent.change(screen.getByLabelText('Min Duration (mins)'), { target: { value: '2' } });
      fireEvent.change(screen.getByLabelText('Max Duration (mins)'), { target: { value: '' } });
      await save();
      expect(savedSettings()).toMatchObject({ min_duration: 120, max_duration: null });
    });

    test('sends only the filter that was edited', async () => {
      setupDialog();
      fireEvent.change(screen.getByLabelText('Min Duration (mins)'), { target: { value: '2' } });
      await save();
      expect(savedSettings()).toMatchObject({ min_duration: 120 });
      expect(savedSettings()).not.toHaveProperty('max_duration');
      expect(savedSettings()).not.toHaveProperty('title_filter_regex');
    });

    // Filters set through the API before this dialog existed were not checked,
    // so the server may reject one now; it must not block an unrelated edit.
    test('saves another setting without resending filters the server would now reject', async () => {
      setupDialog({ playlist: { ...basePlaylist, min_duration: 600, max_duration: 600 } });
      fireEvent.click(screen.getByTestId('subfolder-mock'));
      await save();
      expect(savedSettings()).toMatchObject({ default_sub_folder: 'Kids' });
      expect(savedSettings()).not.toHaveProperty('min_duration');
      expect(savedSettings()).not.toHaveProperty('max_duration');
    });

    describe('when the page refreshes the playlist while the dialog is open', () => {
      const dialog = (playlist: Playlist, open = true) => (
        <PlaylistSettingsDialog open={open} playlist={playlist} token="tok" onClose={jest.fn()} onSaved={jest.fn()} />
      );
      const titleFilter = () => screen.getByLabelText('Title Filter (Python Regex)');

      test('keeps an unsaved edit', () => {
        const { rerender } = render(dialog(basePlaylist));
        fireEvent.change(titleFilter(), { target: { value: 'draft' } });
        rerender(dialog({ ...basePlaylist, video_count: 11 }));
        expect(titleFilter()).toHaveValue('draft');
      });

      // Another session saved a filter meanwhile; saving an unrelated edit must not clear it.
      test('does not send a filter that another session saved and this one never edited', async () => {
        const unfiltered = { ...basePlaylist, title_filter_regex: null };
        const { rerender } = render(dialog(unfiltered));
        fireEvent.click(screen.getByTestId('subfolder-mock'));
        rerender(dialog({ ...unfiltered, title_filter_regex: 'theirs' }));
        await save();
        expect(savedSettings()).toMatchObject({ default_sub_folder: 'Kids' });
        expect(savedSettings()).not.toHaveProperty('title_filter_regex');
      });

      test('shows the refreshed value of a field that was not edited', () => {
        const { rerender } = render(dialog(basePlaylist));
        fireEvent.click(screen.getByTestId('subfolder-mock'));
        rerender(dialog({ ...basePlaylist, title_filter_regex: 'theirs' }));
        expect(titleFilter()).toHaveValue('theirs');
        expect(screen.getByTestId('subfolder-mock')).toHaveTextContent('subfolder:Kids');
      });

      test('saves the refreshed value of another setting that was not edited', async () => {
        const { rerender } = render(dialog(basePlaylist));
        fireEvent.change(titleFilter(), { target: { value: 'draft' } });
        rerender(dialog({ ...basePlaylist, default_sub_folder: 'Theirs' }));
        await save();
        expect(savedSettings()).toMatchObject({ default_sub_folder: 'Theirs', title_filter_regex: 'draft' });
      });

      test('treats a field set back to its saved value as not edited', () => {
        const { rerender } = render(dialog(basePlaylist));
        fireEvent.change(titleFilter(), { target: { value: 'draft' } });
        fireEvent.change(titleFilter(), { target: { value: 'keepme' } });
        rerender(dialog({ ...basePlaylist, title_filter_regex: 'theirs' }));
        expect(titleFilter()).toHaveValue('theirs');
      });

      test('shows a preview of the draft that was still running', async () => {
        let finish: (value: unknown) => void = () => {};
        mockAxiosPost.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
        const { rerender } = render(dialog(basePlaylist));
        fireEvent.change(titleFilter(), { target: { value: 'draft' } });
        fireEvent.click(screen.getByRole('button', { name: 'Preview filters' }));
        rerender(dialog({ ...basePlaylist, video_count: 11 }));
        finish({ data: { totalCount: 4, matchCount: 3, waitingCount: null, truncated: false, videos: [] } });
        expect(await screen.findByText('3 of 4 videos in this playlist match.')).toBeInTheDocument();
      });

      test('discards the edit when the dialog is closed and opened again', () => {
        const { rerender } = render(dialog(basePlaylist));
        fireEvent.change(titleFilter(), { target: { value: 'draft' } });
        rerender(dialog(basePlaylist, false));
        rerender(dialog(basePlaylist));
        expect(titleFilter()).toHaveValue('keepme');
      });

      test('discards the edit when the dialog switches to another playlist', () => {
        const { rerender } = render(dialog(basePlaylist));
        fireEvent.change(titleFilter(), { target: { value: 'draft' } });
        rerender(dialog({ ...basePlaylist, playlist_id: 'PL456', title_filter_regex: 'other' }));
        expect(titleFilter()).toHaveValue('other');
      });
    });

    test('lets the user preview removing all of a playlist\'s saved filters', async () => {
      mockAxiosPost.mockResolvedValue({
        data: { totalCount: 1, matchCount: 1, waitingCount: null, truncated: false, videos: [] },
      });
      setupDialog();
      fireEvent.change(screen.getByLabelText('Title Filter (Python Regex)'), { target: { value: '' } });
      fireEvent.change(screen.getByLabelText('Min Duration (mins)'), { target: { value: '' } });
      fireEvent.change(screen.getByLabelText('Max Duration (mins)'), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Preview filters' }));
      await waitFor(() => expect(mockAxiosPost).toHaveBeenCalledWith(
        '/api/playlists/PL123/filter-preview',
        { title_filter_regex: null, min_duration: null, max_duration: null },
        expect.any(Object)
      ));
    });

    test('offers no preview for a playlist with no filters saved or entered', () => {
      setupDialog({ playlist: { ...basePlaylist, title_filter_regex: null, min_duration: null, max_duration: null } });
      expect(screen.getByRole('button', { name: 'Preview filters' })).toBeDisabled();
    });

    test('counts a filter edit as an unsaved change', () => {
      setupDialog({
        playlist: { ...basePlaylist, auto_download_baseline_at: '2026-09-01T00:00:00Z' },
        onFollowFromNow: jest.fn(),
      });
      fireEvent.change(screen.getByLabelText('Title Filter (Python Regex)'), { target: { value: 'other' } });
      expect(screen.getByRole('button', { name: 'Follow from now...' })).toBeDisabled();
    });

    test('loads the filters of the playlist it is reopened for', () => {
      const { rerender } = render(
        <PlaylistSettingsDialog open playlist={basePlaylist} token="tok" onClose={jest.fn()} onSaved={jest.fn()} />
      );
      rerender(
        <PlaylistSettingsDialog
          open
          playlist={{ ...basePlaylist, title_filter_regex: null, min_duration: null, max_duration: null }}
          token="tok"
          onClose={jest.fn()}
          onSaved={jest.fn()}
        />
      );
      expect(screen.getByLabelText('Title Filter (Python Regex)')).toHaveValue('');
    });
  });

  test('persists an edited download type', async () => {
    setupDialog();

    fireEvent.mouseDown(screen.getByLabelText('Download Type'));
    fireEvent.click(await screen.findByRole('option', { name: 'MP3 Only' }));

    expect(
      screen.getByText(
        'MP3 files are saved at 192kbps in the same folder as videos. MP3 Only playlists sync to media servers as music playlists: the server needs a music-type library that includes your Youtarr output folder.'
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockMutationsReturn.updateSettings).toHaveBeenCalledWith(
        'PL123',
        expect.objectContaining({ audio_format: 'mp3_only' })
      );
    });
  });

  test('explains that a Video + MP3 playlist syncs as a video playlist', async () => {
    setupDialog();

    fireEvent.mouseDown(screen.getByLabelText('Download Type'));
    fireEvent.click(await screen.findByRole('option', { name: 'Video + MP3' }));

    expect(
      screen.getByText(
        'MP3 files are saved at 192kbps in the same folder as videos. Video + MP3 playlists sync to media servers as video playlists: the server needs a video-type library that includes your Youtarr output folder.'
      )
    ).toBeInTheDocument();
  });

  test('persists a subfolder change', async () => {
    setupDialog();

    fireEvent.click(screen.getByTestId('subfolder-mock'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockMutationsReturn.updateSettings).toHaveBeenCalledWith(
        'PL123',
        expect.objectContaining({ default_sub_folder: 'Kids' })
      );
    });
  });

  test('does not close when the save fails', async () => {
    mockMutationsReturn.updateSettings = jest.fn().mockResolvedValue(false);
    const props = setupDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockMutationsReturn.updateSettings).toHaveBeenCalled());
    expect(props.onSaved).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  describe('when a save fails', () => {
    const failSave = async () => {
      mockMutationsReturn.updateSettings = jest.fn().mockResolvedValue(false);
      mockMutationsReturn.error = 'Invalid regex pattern: unterminated character set';
      setupDialog();
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await screen.findByText('Invalid regex pattern: unterminated character set');
    };

    test('shows the error from the mutations hook, once', async () => {
      await failSave();
      expect(screen.getAllByText('Invalid regex pattern: unterminated character set')).toHaveLength(1);
    });

    test('hides the error once a setting is edited, since it described the earlier values', async () => {
      await failSave();
      fireEvent.change(screen.getByLabelText('Title Filter (Python Regex)'), { target: { value: 'fixed' } });
      expect(screen.queryByText('Invalid regex pattern: unterminated character set')).not.toBeInTheDocument();
    });

    test('hides the error when another kind of setting is edited', async () => {
      await failSave();
      fireEvent.click(screen.getByTestId('subfolder-mock'));
      expect(screen.queryByText('Invalid regex pattern: unterminated character set')).not.toBeInTheDocument();
    });

    test('shows the error again when the next save also fails', async () => {
      await failSave();
      fireEvent.change(screen.getByLabelText('Title Filter (Python Regex)'), { target: { value: 'still[bad' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByText('Invalid regex pattern: unterminated character set')).toBeInTheDocument();
    });
  });

  test('does not show an error left over from an earlier save when it opens', () => {
    mockMutationsReturn.error = 'Failed to update settings';
    setupDialog();
    expect(screen.queryByText('Failed to update settings')).not.toBeInTheDocument();
  });

  test.each([
    [true, /are waiting to download automatically/],
    [false, /will download once auto-download is resumed/],
  ])('describes waiting videos by whether auto-download is on (%s)', async (autoDownload, expected) => {
    mockAxiosPost.mockResolvedValue({
      data: { totalCount: 1, matchCount: 1, waitingCount: 2, truncated: false, videos: [] },
    });
    setupDialog({ playlist: { ...basePlaylist, auto_download: autoDownload } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview filters' }));
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  test('warns that the synced playlist becomes a music playlist when switching to MP3 Only', async () => {
    setupDialog();

    fireEvent.mouseDown(screen.getByLabelText('Download Type'));
    fireEvent.click(await screen.findByRole('option', { name: 'MP3 Only' }));

    expect(
      screen.getByText(/replace the synced video playlist with a music playlist/i)
    ).toBeInTheDocument();
  });

  test('warns that the synced playlist becomes a video playlist when leaving MP3 Only', async () => {
    setupDialog({ playlist: { ...basePlaylist, audio_format: 'mp3_only' } });

    fireEvent.mouseDown(screen.getByLabelText('Download Type'));
    fireEvent.click(await screen.findByRole('option', { name: 'Video + MP3' }));

    expect(
      screen.getByText(/replace the synced music playlist with a video playlist/i)
    ).toBeInTheDocument();
  });

  test('shows no sync-type warning when the change stays within video types', async () => {
    setupDialog();

    fireEvent.mouseDown(screen.getByLabelText('Download Type'));
    fireEvent.click(await screen.findByRole('option', { name: 'Video + MP3' }));

    expect(screen.queryByText(/replace the synced/i)).not.toBeInTheDocument();
  });

  test('shows the saved playlist order as the selected value', () => {
    setupDialog({ playlist: { ...basePlaylist, sort_order: 'reversed' } });
    expect(screen.getByLabelText('Playlist order')).toHaveTextContent('Reverse playlist order');
  });

  test('persists an edited playlist order', async () => {
    setupDialog();

    fireEvent.mouseDown(screen.getByLabelText('Playlist order'));
    fireEvent.click(await screen.findByRole('option', { name: 'Reverse playlist order' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockMutationsReturn.updateSettings).toHaveBeenCalledWith(
        'PL123',
        expect.objectContaining({ sort_order: 'reversed' })
      );
    });
  });

  test('reminds the user to re-sync when the playlist order changes', async () => {
    setupDialog();

    expect(screen.queryByText(/applies the next time this playlist syncs/i)).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByLabelText('Playlist order'));
    fireEvent.click(await screen.findByRole('option', { name: 'Reverse playlist order' }));

    expect(screen.getByText(/applies the next time this playlist syncs/i)).toBeInTheDocument();
  });

  test('hides the re-sync reminder when the order is set back to the saved value', async () => {
    setupDialog();

    fireEvent.mouseDown(screen.getByLabelText('Playlist order'));
    fireEvent.click(await screen.findByRole('option', { name: 'Reverse playlist order' }));
    fireEvent.mouseDown(screen.getByLabelText('Playlist order'));
    fireEvent.click(await screen.findByRole('option', { name: 'YouTube playlist order' }));

    expect(screen.queryByText(/applies the next time this playlist syncs/i)).not.toBeInTheDocument();
  });
  test('opens reset confirmation from an established starting point', () => {
    const props = setupDialog({
      playlist: { ...basePlaylist, auto_download_baseline_at: '2026-09-01T00:00:00Z' },
      onFollowFromNow: jest.fn(),
    });
    expect(screen.getByText(/This keeps automatic downloads running or paused/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Follow from now...' }));
    expect(props.onFollowFromNow).toHaveBeenCalledTimes(1);
  });

  test('hides the reset panel before a starting point exists', () => {
    setupDialog({ onFollowFromNow: jest.fn() });
    expect(screen.queryByRole('button', { name: 'Follow from now...' })).not.toBeInTheDocument();
  });

  test('requires saving or discarding settings edits before resetting', () => {
    setupDialog({
      playlist: { ...basePlaylist, auto_download_baseline_at: '2026-09-01T00:00:00Z' },
      onFollowFromNow: jest.fn(),
    });
    fireEvent.click(screen.getByTestId('subfolder-mock'));
    expect(screen.getByRole('button', { name: 'Follow from now...' })).toBeDisabled();
    expect(screen.getByText('Save or discard your settings changes before changing the starting point.')).toBeVisible();
  });

  test('blocks reset while settings are being saved', () => {
    mockMutationsReturn.pending = true;
    setupDialog({
      playlist: { ...basePlaylist, auto_download_baseline_at: '2026-09-01T00:00:00Z' },
      onFollowFromNow: jest.fn(),
    });
    expect(screen.getByRole('button', { name: 'Follow from now...' })).toBeDisabled();
  });

});
