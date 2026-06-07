import { renderHook, act, waitFor } from '@testing-library/react';
import { usePlaylistDetail } from '../usePlaylistDetail';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  isAxiosError: jest.fn(() => false),
}));

const axios = require('axios');

describe('usePlaylistDetail.triggerDownload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: { playlist: {}, videos: [], total: 0 } });
    axios.post.mockResolvedValue({ data: {} });
  });

  test('posts an empty body when no ids are passed', async () => {
    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1' })
    );
    await waitFor(() => expect(axios.get).toHaveBeenCalled());

    await act(async () => {
      await result.current.triggerDownload();
    });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/playlists/PL1/download',
      {},
      { headers: { 'x-access-token': 't' } }
    );
  });

  test('posts videoIds when ids are passed', async () => {
    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1' })
    );
    await waitFor(() => expect(axios.get).toHaveBeenCalled());

    await act(async () => {
      await result.current.triggerDownload(['a', 'b']);
    });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/playlists/PL1/download',
      { videoIds: ['a', 'b'] },
      { headers: { 'x-access-token': 't' } }
    );
  });

  test('posts overrideSettings and videoIds when provided', async () => {
    axios.post.mockResolvedValueOnce({ data: {} });
    const { result } = renderHook(() => usePlaylistDetail({ token: 't', playlistId: 'PL1' }));

    await act(async () => {
      await result.current.triggerDownload(['a', 'b'], { resolution: '720', allowRedownload: true });
    });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/playlists/PL1/download',
      { videoIds: ['a', 'b'], overrideSettings: { resolution: '720', allowRedownload: true } },
      { headers: { 'x-access-token': 't' } }
    );
  });

  test('posts an empty body when no ids or settings are given', async () => {
    axios.post.mockResolvedValueOnce({ data: {} });
    const { result } = renderHook(() => usePlaylistDetail({ token: 't', playlistId: 'PL1' }));

    await act(async () => {
      await result.current.triggerDownload();
    });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/playlists/PL1/download',
      {},
      { headers: { 'x-access-token': 't' } }
    );
  });
});
