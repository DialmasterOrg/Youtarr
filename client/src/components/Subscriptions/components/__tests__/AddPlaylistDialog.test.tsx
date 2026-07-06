import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AddPlaylistDialog from '../AddPlaylistDialog';
import { renderWithProviders } from '../../../../test-utils';
import { PlaylistSubscribeResult } from '../../../../hooks/usePlaylistMutations';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../../hooks/usePlaylistMutations', () => ({
  usePlaylistMutations: jest.fn(),
}));
jest.mock('../../../../hooks/useMediaServerStatus', () => ({
  useMediaServerStatus: jest.fn(),
}));

const { usePlaylistMutations } = require('../../../../hooks/usePlaylistMutations');
const { useMediaServerStatus } = require('../../../../hooks/useMediaServerStatus');

const mockFetchPlaylistInfo = jest.fn();
const mockSubscribe = jest.fn();

const PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PL123';

describe('AddPlaylistDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePlaylistMutations.mockReturnValue({
      fetchPlaylistInfo: mockFetchPlaylistInfo,
      subscribe: mockSubscribe,
      error: null,
      pending: false,
    });
    useMediaServerStatus.mockReturnValue({
      anyConfigured: true,
      status: { plex: true, jellyfin: false, emby: false },
    });
  });

  test('does not fetch while closed', () => {
    renderWithProviders(
      <AddPlaylistDialog open={false} token="t" onClose={jest.fn()} initialUrl={PLAYLIST_URL} />
    );
    expect(mockFetchPlaylistInfo).not.toHaveBeenCalled();
  });

  test('pre-fills the input and auto-fetches when opened with an initialUrl', async () => {
    mockFetchPlaylistInfo.mockResolvedValue({
      title: 'My List',
      uploader: 'Me',
      video_count: 5,
      thumbnail: '',
    });

    renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} initialUrl={PLAYLIST_URL} />);

    const input = screen.getByLabelText('YouTube playlist URL') as HTMLInputElement;
    expect(input.value).toBe(PLAYLIST_URL);

    await waitFor(() => {
      expect(mockFetchPlaylistInfo).toHaveBeenCalledWith(PLAYLIST_URL);
    });
    expect(await screen.findByText('My List')).toBeInTheDocument();
  });

  test('does not auto-fetch when opened without an initialUrl', () => {
    renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} />);
    expect(mockFetchPlaylistInfo).not.toHaveBeenCalled();
  });

  test('subscribes and navigates to the new playlist after preview', async () => {
    const user = userEvent.setup();
    mockFetchPlaylistInfo.mockResolvedValue({
      title: 'My List',
      uploader: 'Me',
      video_count: 5,
      thumbnail: '',
    });
    mockSubscribe.mockResolvedValue({ playlist: { playlist_id: 'PL123' }, restored: false });

    renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} initialUrl={PLAYLIST_URL} />);

    const subscribeBtn = await screen.findByRole('button', { name: /subscribe/i });
    await user.click(subscribeBtn);

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalledWith(PLAYLIST_URL, expect.any(Object));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/playlist/PL123');
  });

  test('navigates with restored state when the subscription restored a soft-deleted playlist', async () => {
    const user = userEvent.setup();
    mockFetchPlaylistInfo.mockResolvedValue({
      title: 'My List',
      uploader: 'Me',
      video_count: 5,
      thumbnail: '',
    });
    mockSubscribe.mockResolvedValue({ playlist: { playlist_id: 'PL123' }, restored: true });

    renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} initialUrl={PLAYLIST_URL} />);

    const subscribeBtn = await screen.findByRole('button', { name: /subscribe/i });
    await user.click(subscribeBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/playlist/PL123', { state: { restored: true } });
    });
  });

  test('notifies onSubscribed with the new playlist on success', async () => {
    const user = userEvent.setup();
    const onSubscribed = jest.fn();
    const playlist = { playlist_id: 'PL123' };
    mockFetchPlaylistInfo.mockResolvedValue({
      title: 'My List',
      uploader: 'Me',
      video_count: 5,
      thumbnail: '',
    });
    mockSubscribe.mockResolvedValue({ playlist, restored: false });

    renderWithProviders(
      <AddPlaylistDialog open token="t" onClose={jest.fn()} onSubscribed={onSubscribed} initialUrl={PLAYLIST_URL} />
    );

    const subscribeBtn = await screen.findByRole('button', { name: /subscribe/i });
    await user.click(subscribeBtn);

    await waitFor(() => {
      expect(onSubscribed).toHaveBeenCalledWith(playlist);
    });
  });

  test('warns when no media server is configured', () => {
    useMediaServerStatus.mockReturnValue({
      anyConfigured: false,
      status: { plex: false, jellyfin: false, emby: false },
    });

    renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} />);
    expect(screen.getByText(/No media server is currently configured/i)).toBeInTheDocument();
  });

  test('shows an in-flight indicator while the subscribe request is outstanding', async () => {
    const user = userEvent.setup();
    mockFetchPlaylistInfo.mockResolvedValue({
      title: 'My List',
      uploader: 'Me',
      video_count: 5,
      thumbnail: '',
    });
    let resolveSubscribe: (value: PlaylistSubscribeResult | null) => void = () => {};
    const subscribePromise = new Promise<PlaylistSubscribeResult | null>((resolve) => {
      resolveSubscribe = resolve;
    });
    mockSubscribe.mockReturnValue(subscribePromise);

    renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} initialUrl={PLAYLIST_URL} />);

    const subscribeBtn = await screen.findByRole('button', { name: /subscribe/i });
    await user.click(subscribeBtn);

    expect(await screen.findByRole('button', { name: 'Subscribing...' })).toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Fetching the complete playlist from YouTube\. Large playlists can take a minute or two - keep this dialog open\./i
      )
    ).toBeInTheDocument();

    resolveSubscribe(null);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument();
    });
  });

  test('clears the in-flight indicator when the subscribe request fails', async () => {
    const user = userEvent.setup();
    mockFetchPlaylistInfo.mockResolvedValue({
      title: 'My List',
      uploader: 'Me',
      video_count: 5,
      thumbnail: '',
    });
    mockSubscribe.mockResolvedValue(null);

    renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} initialUrl={PLAYLIST_URL} />);

    const subscribeBtn = await screen.findByRole('button', { name: /subscribe/i });
    await user.click(subscribeBtn);

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalled();
    });

    expect(await screen.findByRole('button', { name: 'Subscribe' })).toBeInTheDocument();
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Fetching the complete playlist from YouTube/i)
    ).not.toBeInTheDocument();
  });
});
