import { renderHook, waitFor, act } from '@testing-library/react';

jest.mock('axios', () => ({
  get: jest.fn(),
  isAxiosError: (e: unknown) => Boolean(e && (e as { isAxiosError?: boolean }).isAxiosError),
}));

const axios = require('axios');

import { useSubfolderUsage } from '../useSubfolderUsage';
import { SUBFOLDERS_UPDATED_EVENT } from '../useSubfolders';

const item = {
  name: 'Music',
  displayName: '__Music',
  usage: { channels: 2, playlists: 0, isDefault: false, plexMapped: false, hasFiles: true },
  deletable: false,
};

describe('useSubfolderUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does not fetch when token is null', () => {
    renderHook(() => useSubfolderUsage(null));
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('fetches usage items with the auth header', async () => {
    axios.get.mockResolvedValueOnce({ data: [item] });

    const { result } = renderHook(() => useSubfolderUsage('t'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(axios.get).toHaveBeenCalledWith('/api/subfolders', { headers: { 'x-access-token': 't' } });
    expect(result.current.items).toEqual([item]);
    expect(result.current.error).toBeNull();
  });

  test('refetches when a subfolder update event fires', async () => {
    axios.get.mockResolvedValue({ data: [item] });

    const { result } = renderHook(() => useSubfolderUsage('t'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(axios.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event(SUBFOLDERS_UPDATED_EVENT));
    });

    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
  });

  test('surfaces a fetch error', async () => {
    axios.get.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useSubfolderUsage('t'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.items).toEqual([]);
  });
});
