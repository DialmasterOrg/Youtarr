import { act, renderHook, waitFor } from '@testing-library/react';
jest.mock('axios', () => ({ get: jest.fn(), isAxiosError: () => false }));
const axios = require('axios');
import { useLibraryFolderDetail } from '../useLibraryFolderDetail';

describe('useLibraryFolderDetail', () => {
  test('loads the main folder by its route key', async () => {
    axios.get.mockResolvedValue({ data: { name: '', layout: 'videos', channels: [], followers: { count: 0, sample: [] }, playlists: [], titleShows: [], example: null } });
    const { result } = renderHook(() => useLibraryFolderDetail('token', ''));
    await waitFor(() => expect(result.current.detail?.name).toBe(''));
    expect(axios.get).toHaveBeenCalledWith('/api/library-folders/folder/~main', { headers: { 'x-access-token': 'token' } });
  });

  test('refetches when folders change', async () => {
    axios.get.mockResolvedValue({ data: { name: 'Kids', layout: 'videos', channels: [], followers: { count: 0, sample: [] }, playlists: [], titleShows: [], example: null } });
    renderHook(() => useLibraryFolderDetail('token', 'Kids'));
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    act(() => { window.dispatchEvent(new Event('library-folders-updated')); });
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
  });

  test('loads nothing without a folder', () => {
    renderHook(() => useLibraryFolderDetail('token', null));
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('clears loading when the folder is deselected mid-request', async () => {
    axios.get.mockReturnValue(new Promise(() => undefined));
    const { result, rerender } = renderHook(({ name }: { name: string | null }) => useLibraryFolderDetail('token', name), { initialProps: { name: 'Kids' as string | null } });
    await waitFor(() => expect(result.current.loading).toBe(true));
    rerender({ name: null });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
  });
});
