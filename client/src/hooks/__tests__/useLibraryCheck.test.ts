import { renderHook, waitFor, act } from '@testing-library/react';
import { useLibraryCheck } from '../useLibraryCheck';
import { LIBRARY_FOLDERS_UPDATED_EVENT } from '../useLibraryFolders';
import { CONFIG_PATCHED_EVENT } from '../useConfig';

jest.mock('axios', () => ({
  get: jest.fn(),
  put: jest.fn(),
  isAxiosError: (err: { isAxiosError?: boolean }) => Boolean(err && err.isAxiosError),
}));

const axios = require('axios');

const RESPONSE = { servers: [{ serverType: 'plex', name: 'Plex', reachable: true, error: null }], folders: [] };

describe('useLibraryCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: RESPONSE });
  });

  test('loads the check', async () => {
    const { result } = renderHook(() => useLibraryCheck('token'));

    await waitFor(() => expect(result.current.data).toEqual(RESPONSE));
    expect(axios.get).toHaveBeenCalledWith('/api/library-folders/check', expect.objectContaining({
      headers: { 'x-access-token': 'token' },
    }));
  });

  describe('lastCheckedAt', () => {
    afterEach(() => jest.restoreAllMocks());

    test('records when the last check succeeded and keeps it after a failed refresh', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(1_000);
      axios.get.mockResolvedValueOnce({ data: { servers: [], folders: [] } });
      const { result } = renderHook(() => useLibraryCheck('token'));
      await waitFor(() => expect(result.current.lastCheckedAt).toBe(1_000));

      axios.get.mockRejectedValueOnce(new Error('down'));
      await act(async () => { await result.current.refetch(); });

      expect(result.current.lastCheckedAt).toBe(1_000);
      expect(result.current.data).toEqual({ servers: [], folders: [] });
    });
  });

  test('asks only for the given folders', async () => {
    const { result } = renderHook(() => useLibraryCheck('token', { folders: ['TV', ''] }));

    await waitFor(() => expect(result.current.data).toEqual(RESPONSE));
    const params = axios.get.mock.calls[0][1].params as URLSearchParams;
    expect(params.getAll('folder')).toEqual(['TV', '']);
  });

  test('asks for the given folders to be checked as another layout', async () => {
    const { result } = renderHook(() => useLibraryCheck('token', { folders: ['TV'], layout: 'tv' }));

    await waitFor(() => expect(result.current.data).toEqual(RESPONSE));
    const params = axios.get.mock.calls[0][1].params as URLSearchParams;
    expect(params.get('layout')).toBe('tv');
  });

  test('waits while disabled', () => {
    renderHook(() => useLibraryCheck('token', { enabled: false }));

    expect(axios.get).not.toHaveBeenCalled();
  });

  test('stops loading when disabled while a check is in flight', async () => {
    let settle: (value: { data: typeof RESPONSE }) => void = () => undefined;
    axios.get.mockReturnValue(new Promise((resolve) => { settle = resolve; }));
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useLibraryCheck('token', { enabled }),
      { initialProps: { enabled: true } }
    );
    await waitFor(() => expect(result.current.loading).toBe(true));

    rerender({ enabled: false });
    await act(async () => { settle({ data: RESPONSE }); });

    expect(result.current.loading).toBe(false);
  });

  test('drops the previous folders\' report when disabled for other folders', async () => {
    const { result, rerender } = renderHook(
      ({ folders, enabled }: { folders: string[]; enabled: boolean }) => useLibraryCheck('token', { folders, enabled }),
      { initialProps: { folders: ['TV'], enabled: true } }
    );
    await waitFor(() => expect(result.current.data).toEqual(RESPONSE));

    rerender({ folders: [], enabled: false });

    await waitFor(() => expect(result.current.data).toBeNull());
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test('drops the previous folders\' report while checking other folders', async () => {
    let settle: (value: { data: typeof RESPONSE }) => void = () => undefined;
    const { result, rerender } = renderHook(
      ({ folders }: { folders: string[] }) => useLibraryCheck('token', { folders }),
      { initialProps: { folders: ['TV'] } }
    );
    await waitFor(() => expect(result.current.data).toEqual(RESPONSE));
    axios.get.mockReturnValue(new Promise((resolve) => { settle = resolve; }));

    rerender({ folders: ['Kids'] });

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.data).toBeNull();
    await act(async () => { settle({ data: RESPONSE }); });
  });

  test("shows the server's error", async () => {
    axios.get.mockRejectedValue({ isAxiosError: true, response: { data: { error: 'Failed to check the media server libraries' } } });
    const { result } = renderHook(() => useLibraryCheck('token'));

    await waitFor(() => expect(result.current.error).toBe('Failed to check the media server libraries'));
  });

  test('checks again when a folder layout changes', async () => {
    const { result } = renderHook(() => useLibraryCheck('token'));
    await waitFor(() => expect(result.current.data).toEqual(RESPONSE));

    act(() => { window.dispatchEvent(new Event(LIBRARY_FOLDERS_UPDATED_EVENT)); });

    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  test('saves a Plex mapping, hands the saved mappings to the config and checks again', async () => {
    const mappings = [{ subfolder: 'Kids', libraryId: '12' }, { subfolder: 'TV', libraryId: '41' }];
    axios.put.mockResolvedValue({ data: { mappedLibraryId: '41', plexSubfolderLibraryMappings: mappings } });
    const patches: unknown[] = [];
    const listener = (event: Event) => { patches.push((event as CustomEvent).detail); };
    window.addEventListener(CONFIG_PATCHED_EVENT, listener);
    const { result } = renderHook(() => useLibraryCheck('token'));
    await waitFor(() => expect(result.current.data).toEqual(RESPONSE));

    await act(async () => { await result.current.applyPlexMapping('TV', '41'); });

    expect(axios.put).toHaveBeenCalledWith('/api/library-folders/plex-mapping', { folder: 'TV', libraryId: '41' }, expect.any(Object));
    expect(patches).toEqual([{ plexSubfolderLibraryMappings: mappings }]);
    expect(axios.get).toHaveBeenCalledTimes(2);
    window.removeEventListener(CONFIG_PATCHED_EVENT, listener);
  });

  test('tells the folder list a saved mapping changed, checking once', async () => {
    axios.put.mockResolvedValue({ data: { mappedLibraryId: '41', plexSubfolderLibraryMappings: [] } });
    const updated = jest.fn();
    window.addEventListener(LIBRARY_FOLDERS_UPDATED_EVENT, updated);
    const { result } = renderHook(() => useLibraryCheck('token'));
    await waitFor(() => expect(result.current.data).toEqual(RESPONSE));

    await act(async () => { await result.current.applyPlexMapping('TV', '41'); });

    expect(updated).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    window.removeEventListener(LIBRARY_FOLDERS_UPDATED_EVENT, updated);
  });

  test('resolves applyPlexMapping only once the refreshed check is in, with one check request', async () => {
    axios.put.mockResolvedValue({ data: { mappedLibraryId: '41', plexSubfolderLibraryMappings: [] } });
    const updated = jest.fn();
    window.addEventListener(LIBRARY_FOLDERS_UPDATED_EVENT, updated);
    const { result } = renderHook(() => useLibraryCheck('token'));
    await waitFor(() => expect(result.current.data).toEqual(RESPONSE));

    const refreshed = { servers: [], folders: [] };
    let release: (value: { data: typeof refreshed }) => void = () => undefined;
    axios.get.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    let done = false;
    let applied: Promise<void> = Promise.resolve();
    act(() => { applied = result.current.applyPlexMapping('TV', '41').then(() => { done = true; }); });
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    await act(async () => { await Promise.resolve(); });
    expect(done).toBe(false);

    await act(async () => { release({ data: refreshed }); await applied; });

    expect(done).toBe(true);
    expect(result.current.data).toEqual(refreshed);
    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(updated).toHaveBeenCalledTimes(1);
    window.removeEventListener(LIBRARY_FOLDERS_UPDATED_EVENT, updated);
  });

  test("throws the server's refusal when the mapping fails", async () => {
    axios.put.mockRejectedValue({ isAxiosError: true, response: { data: { error: 'Already mapped.' } } });
    const { result } = renderHook(() => useLibraryCheck('token'));
    await waitFor(() => expect(result.current.data).toEqual(RESPONSE));

    await expect(result.current.applyPlexMapping('TV', '41')).rejects.toThrow('Already mapped.');
  });
});
