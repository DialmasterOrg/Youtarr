import { renderHook, waitFor, act } from '@testing-library/react';

jest.mock('axios', () => ({
  get: jest.fn(),
  put: jest.fn(),
  isAxiosError: (e: unknown) => Boolean(e && (e as { isAxiosError?: boolean }).isAxiosError),
}));

const axios = require('axios');

import { useLibraryFolders, LIBRARY_FOLDERS_UPDATED_EVENT } from '../useLibraryFolders';
import { SUBFOLDERS_UPDATED_EVENT } from '../useSubfolders';

const FOLDERS = [
  { name: '', layout: 'videos', isDefault: true, hasFiles: true, channels: 3 },
  { name: 'TV Shows', layout: 'tv', isDefault: false, hasFiles: false, channels: 1 },
];

describe('useLibraryFolders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: { folders: FOLDERS } });
  });

  test('does not fetch without a token', () => {
    renderHook(() => useLibraryFolders(null));
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('loads the folders with the auth header', async () => {
    const { result } = renderHook(() => useLibraryFolders('token'));
    await waitFor(() => expect(result.current.folders).toEqual(FOLDERS));
    expect(axios.get).toHaveBeenCalledWith('/api/library-folders', { headers: { 'x-access-token': 'token' } });
  });

  test('resolves layouts from the loaded folders', async () => {
    const { result } = renderHook(() => useLibraryFolders('token'));
    await waitFor(() => expect(result.current.layoutOf('tv shows')).toBe('tv'));
  });

  test('reports a load failure with the server message', async () => {
    axios.get.mockRejectedValueOnce({ isAxiosError: true, response: { data: { error: 'boom' } } });
    const { result } = renderHook(() => useLibraryFolders('token'));
    await waitFor(() => expect(result.current.error).toBe('boom'));
  });

  test('changes a layout and announces it', async () => {
    const updated = [FOLDERS[0], { ...FOLDERS[1], layout: 'videos' }];
    axios.put.mockResolvedValueOnce({ data: { changed: true, folders: updated } });
    const listener = jest.fn();
    window.addEventListener(LIBRARY_FOLDERS_UPDATED_EVENT, listener);
    const { result } = renderHook(() => useLibraryFolders('token'));
    await waitFor(() => expect(result.current.folders).toEqual(FOLDERS));

    await act(async () => { await result.current.setFolderLayout('TV Shows', 'videos'); });

    expect(axios.put).toHaveBeenCalledWith(
      '/api/library-folders', { name: 'TV Shows', layout: 'videos' }, { headers: { 'x-access-token': 'token' } }
    );
    expect(listener).toHaveBeenCalled();
    window.removeEventListener(LIBRARY_FOLDERS_UPDATED_EVENT, listener);
  });

  test('throws the refusal message when a change is refused', async () => {
    axios.put.mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { error: 'holds downloads' } } });
    const { result } = renderHook(() => useLibraryFolders('token'));
    await waitFor(() => expect(result.current.folders).toEqual(FOLDERS));

    await expect(result.current.setFolderLayout('', 'tv')).rejects.toThrow('holds downloads');
  });

  test('throws a ReorganizeRequiredError when the folder\'s files must move', async () => {
    const change = { type: 'folderLayout', folder: '', layout: 'tv' };
    axios.put.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 409, data: { error: 'Review the move', reorganizeRequired: true, change } },
    });
    const { result } = renderHook(() => useLibraryFolders('token'));
    await waitFor(() => expect(result.current.folders).toEqual(FOLDERS));

    await expect(result.current.setFolderLayout('', 'tv')).rejects.toMatchObject({ name: 'ReorganizeRequiredError', change });
  });

  test('asks for the included fields', async () => {
    axios.get.mockResolvedValueOnce({ data: { folders: [] } });

    renderHook(() => useLibraryFolders('token', { include: ['usage', 'files'] }));

    await waitFor(() => expect(axios.get).toHaveBeenCalledWith('/api/library-folders', {
      headers: { 'x-access-token': 'token' },
      params: { include: 'usage,files' },
    }));
  });

  test('is loaded only after the first answer', async () => {
    axios.get.mockResolvedValueOnce({ data: { folders: [{ name: '', layout: 'videos', isDefault: true, hasFiles: false, channels: 0 }] } });

    const { result } = renderHook(() => useLibraryFolders('token'));

    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
  });

  test('with include, a layout change refetches instead of taking the plain list', async () => {
    const withUsage = { name: 'TV', layout: 'tv', isDefault: false, hasFiles: false, channels: 0, fileCount: 3 };
    axios.get.mockResolvedValueOnce({ data: { folders: [withUsage] } });
    // The refetch the layout event triggers never answers, so only the PUT's list could change the state.
    axios.get.mockImplementation(() => new Promise(() => {}));
    axios.put.mockResolvedValueOnce({ data: { changed: true, folders: [{ ...withUsage, fileCount: undefined }] } });
    const { result } = renderHook(() => useLibraryFolders('token', { include: ['files'] }));
    await waitFor(() => expect(result.current.folders).toHaveLength(1));

    await act(async () => { await result.current.setFolderLayout('TV', 'videos'); });

    expect(result.current.folders[0].fileCount).toBe(3);
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test('an older answer that arrives last does not overwrite the newer one, and loading lasts until the latest answers', async () => {
    const answers: Array<(value: unknown) => void> = [];
    axios.get.mockImplementation(() => new Promise((resolve) => { answers.push(resolve); }));
    const { result } = renderHook(() => useLibraryFolders('token', { include: ['usage', 'files'] }));
    await waitFor(() => expect(answers).toHaveLength(1));
    act(() => { void result.current.refetch(); });
    await waitFor(() => expect(answers).toHaveLength(2));

    await act(async () => { answers[1]({ data: { folders: [FOLDERS[1]] } }); });
    await act(async () => { answers[0]({ data: { folders: FOLDERS } }); });

    expect(result.current.folders).toEqual([FOLDERS[1]]);
    expect(result.current.loading).toBe(false);
  });

  test('loading stays on while a newer request is still running', async () => {
    const answers: Array<(value: unknown) => void> = [];
    axios.get.mockImplementation(() => new Promise((resolve) => { answers.push(resolve); }));
    const { result } = renderHook(() => useLibraryFolders('token', { include: ['usage', 'files'] }));
    await waitFor(() => expect(answers).toHaveLength(1));
    act(() => { void result.current.refetch(); });
    await waitFor(() => expect(answers).toHaveLength(2));

    await act(async () => { answers[0]({ data: { folders: FOLDERS } }); });

    expect(result.current.loading).toBe(true);
    expect(result.current.folders).toEqual([]);
  });

  test('refetches when subfolders change', async () => {
    renderHook(() => useLibraryFolders('token'));
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));

    act(() => { window.dispatchEvent(new Event(SUBFOLDERS_UPDATED_EVENT)); });

    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
  });
});
