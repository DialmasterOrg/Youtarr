import { renderHook, waitFor, act } from '@testing-library/react';

jest.mock('axios', () => ({
  get: jest.fn(),
  put: jest.fn(),
  isAxiosError: (e: unknown) => Boolean(e && (e as { isAxiosError?: boolean }).isAxiosError),
}));

const axios = require('axios');

import { useChannelTv } from '../useChannelTv';
import { LIBRARY_FOLDERS_UPDATED_EVENT } from '../../../../hooks/useLibraryFolders';

const TV_STATE = {
  layout: 'videos',
  libraryFolder: 'Kids',
  show: null,
  tvFolders: ['TV'],
  defaultFolder: 'Kids',
  defaultFolderLayout: 'videos',
  hasDownloads: false,
  canSwitch: true,
};

describe('useChannelTv', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: TV_STATE });
  });

  test('loads the channel TV state', async () => {
    const { result } = renderHook(() => useChannelTv('UC1', 'token'));
    await waitFor(() => expect(result.current.tv).toEqual(TV_STATE));
    expect(axios.get).toHaveBeenCalledWith('/api/channels/UC1/tv', { headers: { 'x-access-token': 'token' } });
  });

  test('does not fetch while disabled', () => {
    renderHook(() => useChannelTv('UC1', 'token', false));
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('switches the layout and keeps the returned state', async () => {
    const tvAfter = { ...TV_STATE, layout: 'tv', libraryFolder: 'TV' };
    axios.put.mockResolvedValueOnce({ data: { settings: { sub_folder: 'TV' }, tv: tvAfter } });
    const { result } = renderHook(() => useChannelTv('UC1', 'token'));
    await waitFor(() => expect(result.current.tv).toEqual(TV_STATE));

    let switched;
    await act(async () => { switched = await result.current.switchLayout('tv', 'TV'); });

    expect(axios.put).toHaveBeenCalledWith(
      '/api/channels/UC1/tv/layout', { layout: 'tv', folder: 'TV' }, { headers: { 'x-access-token': 'token' } }
    );
    expect(switched).toEqual({ settings: { sub_folder: 'TV' }, tv: tvAfter });
    expect(result.current.tv).toEqual(tvAfter);
  });

  test('sends no folder when none is chosen', async () => {
    axios.put.mockResolvedValueOnce({ data: { settings: { sub_folder: 'TV' }, tv: TV_STATE } });
    const { result } = renderHook(() => useChannelTv('UC1', 'token'));
    await waitFor(() => expect(result.current.tv).not.toBeNull());

    await act(async () => { await result.current.switchLayout('videos'); });

    expect(axios.put.mock.calls[0][1]).toEqual({ layout: 'videos' });
  });

  test('throws the server refusal', async () => {
    axios.put.mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { error: 'has downloads' } } });
    const { result } = renderHook(() => useChannelTv('UC1', 'token'));
    await waitFor(() => expect(result.current.tv).not.toBeNull());

    await expect(result.current.switchLayout('tv')).rejects.toThrow('has downloads');
  });

  test('refetches when a folder layout changes', async () => {
    renderHook(() => useChannelTv('UC1', 'token'));
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));

    act(() => { window.dispatchEvent(new Event(LIBRARY_FOLDERS_UPDATED_EVENT)); });

    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
  });

  test('keeps a switch result over an older refetch that finishes later', async () => {
    const tvAfter = { ...TV_STATE, layout: 'tv', libraryFolder: 'TV' };
    const { result } = renderHook(() => useChannelTv('UC1', 'token'));
    await waitFor(() => expect(result.current.tv).toEqual(TV_STATE));

    let resolveStaleFetch: (value: unknown) => void = () => {};
    axios.get.mockImplementationOnce(() => new Promise((resolve) => { resolveStaleFetch = resolve; }));
    act(() => { window.dispatchEvent(new Event(LIBRARY_FOLDERS_UPDATED_EVENT)); });
    axios.put.mockResolvedValueOnce({ data: { settings: { sub_folder: 'TV' }, tv: tvAfter } });
    await act(async () => { await result.current.switchLayout('tv'); });
    await act(async () => { resolveStaleFetch({ data: TV_STATE }); });

    expect(result.current.tv).toEqual(tvAfter);
  });
});

