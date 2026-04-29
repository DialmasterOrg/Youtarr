import { renderHook, act, waitFor } from '@testing-library/react';

jest.mock('axios', () => ({
  post: jest.fn(),
  isCancel: (err: unknown) => Boolean(err && (err as { name?: string }).name === 'CanceledError'),
  CanceledError: class CanceledError extends Error {
    constructor() { super('canceled'); this.name = 'CanceledError'; }
  },
}));

const axios = require('axios');
const { useVideoSearch } = require('../useVideoSearch');

describe('useVideoSearch', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('happy path: search resolves with results', async () => {
    axios.post.mockResolvedValueOnce({ data: { results: [{ youtubeId: 'a', title: 'A' }] } });
    const { result } = renderHook(() => useVideoSearch('token'));

    await act(async () => { await result.current.search('minecraft', 25); });
    expect(result.current.results).toEqual([{ youtubeId: 'a', title: 'A' }]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('second search while loading aborts the first and runs the new one', async () => {
    const firstSignals: AbortSignal[] = [];
    axios.post.mockImplementationOnce((_url: string, _body: unknown, opts: { signal?: AbortSignal }) => {
      if (opts.signal) firstSignals.push(opts.signal);
      return new Promise((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => reject(new axios.CanceledError()));
      });
    });
    axios.post.mockResolvedValueOnce({ data: { results: [{ youtubeId: 'b', title: 'B' }] } });

    const { result } = renderHook(() => useVideoSearch('token'));

    act(() => { result.current.search('first', 25); });
    await waitFor(() => expect(result.current.loading).toBe(true));

    await act(async () => { await result.current.search('second', 25); });

    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(firstSignals[0].aborted).toBe(true);
    expect(result.current.results).toEqual([{ youtubeId: 'b', title: 'B' }]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('starting a new search clears stale results so they do not persist on screen', async () => {
    axios.post.mockResolvedValueOnce({ data: { results: [{ youtubeId: 'old', title: 'Old' }] } });
    let resolveSecond: (v: unknown) => void = () => {};
    axios.post.mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    const { result } = renderHook(() => useVideoSearch('token'));
    await act(async () => { await result.current.search('first', 25); });
    expect(result.current.results).toEqual([{ youtubeId: 'old', title: 'Old' }]);

    act(() => { result.current.search('second', 25); });
    await waitFor(() => expect(result.current.loading).toBe(true));
    // While the second search is in flight, the old results must be gone.
    expect(result.current.results).toEqual([]);

    await act(async () => {
      resolveSecond({ data: { results: [{ youtubeId: 'new', title: 'New' }] } });
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.results).toEqual([{ youtubeId: 'new', title: 'New' }]);
  });

  test('cancel aborts the request and clears state without setting error', async () => {
    axios.post.mockImplementationOnce((_url: string, _body: unknown, opts: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => reject(new axios.CanceledError()));
      })
    );

    const { result } = renderHook(() => useVideoSearch('token'));
    act(() => { result.current.search('x', 25); });
    await waitFor(() => expect(result.current.loading).toBe(true));

    await act(async () => { result.current.cancel(); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  test('non-cancel error sets error message', async () => {
    axios.post.mockRejectedValueOnce({ response: { status: 502, data: { error: 'Search failed' } } });
    const { result } = renderHook(() => useVideoSearch('token'));
    await act(async () => { await result.current.search('x', 25); });
    expect(result.current.error).toBe('Search failed');
    expect(result.current.loading).toBe(false);
  });

  test('unmount aborts in-flight request', async () => {
    let signalRef: AbortSignal | undefined;
    axios.post.mockImplementationOnce((_url: string, _body: unknown, opts: { signal?: AbortSignal }) => {
      signalRef = opts.signal;
      return new Promise(() => {});
    });
    const { result, unmount } = renderHook(() => useVideoSearch('token'));
    act(() => { result.current.search('x', 25); });
    await waitFor(() => expect(result.current.loading).toBe(true));

    unmount();
    expect(signalRef?.aborted).toBe(true);
  });
});
