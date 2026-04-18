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

  test('single in-flight: second search while loading is ignored', async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    axios.post.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));

    const { result } = renderHook(() => useVideoSearch('token'));

    act(() => { result.current.search('first', 25); });
    await waitFor(() => expect(result.current.loading).toBe(true));

    act(() => { result.current.search('second', 25); });
    expect(axios.post).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst({ data: { results: [] } });
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
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
