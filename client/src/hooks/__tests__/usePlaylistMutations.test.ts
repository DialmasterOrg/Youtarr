import { renderHook, act } from '@testing-library/react';
import { usePlaylistMutations, PlaylistSubscribeResult } from '../usePlaylistMutations';

jest.mock('axios', () => ({
  post: jest.fn(),
  delete: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  isAxiosError: jest.fn(() => false),
}));

const axios = require('axios');

describe('usePlaylistMutations.subscribe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns the playlist and restored flag from the API', async () => {
    const playlist = { playlist_id: 'PL1', title: 'Restored' };
    axios.post.mockResolvedValue({ data: { playlist, restored: true } });

    const { result } = renderHook(() => usePlaylistMutations({ token: 't' }));

    let res: PlaylistSubscribeResult | null = null;
    await act(async () => {
      res = await result.current.subscribe('https://youtube.com/playlist?list=PL1', {});
    });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/playlists',
      { url: 'https://youtube.com/playlist?list=PL1', settings: {} },
      { headers: { 'x-access-token': 't' } }
    );
    expect(res).toEqual({ playlist, restored: true });
  });

  test('preserves a successful subscription warning for the destination page', async () => {
    const playlist = { playlist_id: 'PL1', auto_download: false };
    const warning = 'Playlist saved. Auto-download was turned off; retry setup later.';
    axios.post.mockResolvedValue({ data: { playlist, restored: true, warning } });
    const { result } = renderHook(() => usePlaylistMutations({ token: 't' }));
    let response: PlaylistSubscribeResult | null = null;
    await act(async () => { response = await result.current.subscribe('https://youtube.com/playlist?list=PL1'); });
    expect(response).toEqual({ playlist, restored: true, warning });
    expect(result.current.error).toBeNull();
  });

  test('defaults restored to false when the API omits it', async () => {
    const playlist = { playlist_id: 'PL1', title: 'New' };
    axios.post.mockResolvedValue({ data: { playlist } });

    const { result } = renderHook(() => usePlaylistMutations({ token: 't' }));

    let res: PlaylistSubscribeResult | null = null;
    await act(async () => {
      res = await result.current.subscribe('https://youtube.com/playlist?list=PL1');
    });

    expect(res).toEqual({ playlist, restored: false });
  });

  test('returns null and sets error when the request fails', async () => {
    axios.post.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => usePlaylistMutations({ token: 't' }));

    let res: PlaylistSubscribeResult | null = null;
    await act(async () => {
      res = await result.current.subscribe('https://youtube.com/playlist?list=PL1');
    });

    expect(res).toBeNull();
    expect(result.current.error).toBe('Failed to subscribe to playlist');
  });
});

describe('usePlaylistMutations.unsubscribe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deletes the playlist and returns true', async () => {
    axios.delete.mockResolvedValue({ data: { success: true } });

    const { result } = renderHook(() => usePlaylistMutations({ token: 't' }));

    let res = false;
    await act(async () => {
      res = await result.current.unsubscribe('PL1');
    });

    expect(axios.delete).toHaveBeenCalledWith('/api/playlists/PL1', {
      headers: { 'x-access-token': 't' },
    });
    expect(res).toBe(true);
  });

  test('returns false and sets error when the request fails', async () => {
    axios.delete.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => usePlaylistMutations({ token: 't' }));

    let res = true;
    await act(async () => {
      res = await result.current.unsubscribe('PL1');
    });

    expect(res).toBe(false);
    expect(result.current.error).toBe('Failed to unsubscribe');
  });

  test('does not call the API without a token', async () => {
    const { result } = renderHook(() => usePlaylistMutations({ token: null }));

    let res = true;
    await act(async () => {
      res = await result.current.unsubscribe('PL1');
    });

    expect(res).toBe(false);
    expect(axios.delete).not.toHaveBeenCalled();
  });
});

describe('usePlaylistMutations.updateSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('puts the settings payload including sort_order', async () => {
    axios.put.mockResolvedValue({ data: { settings: {} } });

    const { result } = renderHook(() => usePlaylistMutations({ token: 't' }));

    let res = false;
    await act(async () => {
      res = await result.current.updateSettings('PL1', { sort_order: 'reversed' });
    });

    expect(axios.put).toHaveBeenCalledWith(
      '/api/playlists/PL1/settings',
      { sort_order: 'reversed' },
      { headers: { 'x-access-token': 't' } }
    );
    expect(res).toBe(true);
  });

  test('returns false and sets error when the request fails', async () => {
    axios.put.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => usePlaylistMutations({ token: 't' }));

    let res = true;
    await act(async () => {
      res = await result.current.updateSettings('PL1', { sort_order: 'default' });
    });

    expect(res).toBe(false);
    expect(result.current.error).toBe('Failed to update settings');
  });
});

describe('usePlaylistMutations.ignoreVideos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('posts the selected video ids to the bulk ignore endpoint', async () => {
    axios.post.mockResolvedValue({ data: { success: true, ignored: 2 } });

    const { result } = renderHook(() => usePlaylistMutations({ token: 't' }));

    let res: number | null = null;
    await act(async () => {
      res = await result.current.ignoreVideos('PL1', ['a', 'b']);
    });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/playlists/PL1/videos/bulk-ignore',
      { videoIds: ['a', 'b'] },
      { headers: { 'x-access-token': 't' } }
    );
    expect(res).toBe(2);
  });

  test('returns the number the server newly ignored, which can be fewer than sent', async () => {
    axios.post.mockResolvedValue({ data: { success: true, ignored: 0 } });

    const { result } = renderHook(() => usePlaylistMutations({ token: 't' }));

    let res: number | null = null;
    await act(async () => {
      res = await result.current.ignoreVideos('PL1', ['a', 'b']);
    });

    expect(res).toBe(0);
  });

  test('returns null and sets error when the request fails', async () => {
    axios.post.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => usePlaylistMutations({ token: 't' }));

    let res: number | null = 1;
    await act(async () => {
      res = await result.current.ignoreVideos('PL1', ['a']);
    });

    expect(res).toBeNull();
    expect(result.current.error).toBe('Failed to ignore videos');
  });

  test('sends nothing without a token', async () => {
    const { result } = renderHook(() => usePlaylistMutations({ token: null }));

    let res: number | null = 1;
    await act(async () => {
      res = await result.current.ignoreVideos('PL1', ['a']);
    });

    expect(res).toBeNull();
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('usePlaylistMutations.runPendingRefresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('asks the server to run the waiting refresh', async () => {
    axios.post.mockResolvedValue({ data: { started: true } });

    const { result } = renderHook(() => usePlaylistMutations({ token: 't' }));

    await act(async () => {
      await result.current.runPendingRefresh('PL1');
    });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/playlists/PL1/run-pending-refresh',
      {},
      { headers: { 'x-access-token': 't' } }
    );
  });

  test('resolves without setting an error when the request fails', async () => {
    axios.post.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => usePlaylistMutations({ token: 't' }));

    await act(async () => {
      await result.current.runPendingRefresh('PL1');
    });

    expect(result.current.error).toBeNull();
  });
});
