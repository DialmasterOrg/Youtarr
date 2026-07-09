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

  test('renders dropdowns seeded from the playlist values', () => {
    setupDialog();
    expect(screen.getByLabelText('Video Quality')).toHaveTextContent('720p (HD)');
    expect(screen.getByLabelText('Download Type')).toHaveTextContent('Video Only (default)');
    expect(screen.getByLabelText('Default Rating')).toHaveTextContent('PG');
    expect(screen.getByTestId('subfolder-mock')).toHaveTextContent('subfolder:null');
  });

  test('saves only the four surfaced fields and leaves filter columns untouched', async () => {
    const props = setupDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockMutationsReturn.updateSettings).toHaveBeenCalledWith('PL123', {
        default_sub_folder: null,
        video_quality: '720',
        audio_format: null,
        default_rating: 'PG',
      });
    });
    const payload = mockMutationsReturn.updateSettings.mock.calls[0][1];
    expect(payload).not.toHaveProperty('min_duration');
    expect(payload).not.toHaveProperty('max_duration');
    expect(payload).not.toHaveProperty('title_filter_regex');

    await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
    expect(props.onClose).toHaveBeenCalled();
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

  test('surfaces a save error from the mutations hook', () => {
    mockMutationsReturn.error = 'Failed to update settings';
    setupDialog();
    expect(screen.getByText('Failed to update settings')).toBeInTheDocument();
  });
});
