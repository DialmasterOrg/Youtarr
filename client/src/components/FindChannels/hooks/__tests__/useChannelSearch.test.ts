import { renderHook, act, waitFor } from '@testing-library/react';

jest.mock('axios', () => ({
  post: jest.fn(),
  isCancel: (err: unknown) => Boolean(err && (err as { name?: string }).name === 'CanceledError'),
  CanceledError: class CanceledError extends Error {
    constructor() { super('canceled'); this.name = 'CanceledError'; }
  },
}));

const axios = require('axios');
const { useChannelSearch } = require('../useChannelSearch');

const result = (overrides = {}) => ({
  channelId: 'UCa',
  name: 'Alpha',
  handle: '@alpha',
  url: 'https://www.youtube.com/channel/UCa',
  thumbnailUrl: null,
  subscriberCount: 100,
  videoCount: null,
  description: null,
  subscribed: false,
  ...overrides,
});

describe('useChannelSearch', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('happy path: search resolves with results', async () => {
    axios.post.mockResolvedValueOnce({ data: { results: [result()] } });
    const { result: hook } = renderHook(() => useChannelSearch('token'));

    await act(async () => { await hook.current.search('alpha', 25); });

    expect(hook.current.results).toEqual([result()]);
    expect(hook.current.loading).toBe(false);
    expect(hook.current.error).toBeNull();
    expect(axios.post).toHaveBeenCalledWith(
      '/api/channels/search',
      { query: 'alpha', count: 25 },
      expect.objectContaining({ headers: { 'x-access-token': 'token' } })
    );
  });

  test('decodes HTML entities in channel names from the YouTube API', async () => {
    axios.post.mockResolvedValueOnce({
      data: { results: [result({ name: 'Tom &amp; Jerry&#39;s' })] },
    });
    const { result: hook } = renderHook(() => useChannelSearch('token'));

    await act(async () => { await hook.current.search('tom', 25); });

    expect(hook.current.results[0].name).toBe("Tom & Jerry's");
  });

  test('second search while loading aborts the first and runs the new one', async () => {
    const firstSignals: AbortSignal[] = [];
    axios.post.mockImplementationOnce((_url: string, _body: unknown, opts: { signal?: AbortSignal }) => {
      if (opts.signal) firstSignals.push(opts.signal);
      return new Promise((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => reject(new axios.CanceledError()));
      });
    });
    axios.post.mockResolvedValueOnce({ data: { results: [result({ channelId: 'UCb', name: 'B' })] } });

    const { result: hook } = renderHook(() => useChannelSearch('token'));

    act(() => { hook.current.search('first', 25); });
    await waitFor(() => expect(hook.current.loading).toBe(true));

    await act(async () => { await hook.current.search('second', 25); });

    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(firstSignals[0].aborted).toBe(true);
    expect(hook.current.results[0].channelId).toBe('UCb');
    expect(hook.current.loading).toBe(false);
  });

  test('cancel() aborts the in-flight request without surfacing an error', async () => {
    let capturedSignal: AbortSignal | undefined;
    axios.post.mockImplementationOnce((_url: string, _body: unknown, opts: { signal?: AbortSignal }) => {
      capturedSignal = opts.signal;
      return new Promise((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => reject(new axios.CanceledError()));
      });
    });

    const { result: hook } = renderHook(() => useChannelSearch('token'));

    act(() => { hook.current.search('slow', 25); });
    await waitFor(() => expect(hook.current.loading).toBe(true));

    await act(async () => { hook.current.cancel(); });

    await waitFor(() => expect(capturedSignal?.aborted).toBe(true));
    expect(hook.current.error).toBeNull();
  });

  test('surfaces the server error message on failure', async () => {
    axios.post.mockRejectedValueOnce({ response: { data: { error: 'Search timed out' } } });
    const { result: hook } = renderHook(() => useChannelSearch('token'));

    await act(async () => { await hook.current.search('x', 25); });

    expect(hook.current.error).toBe('Search timed out');
    expect(hook.current.loading).toBe(false);
  });

  test('starting a new search clears stale results', async () => {
    axios.post.mockResolvedValueOnce({ data: { results: [result({ channelId: 'old' })] } });
    axios.post.mockImplementationOnce(() => new Promise(() => {}));

    const { result: hook } = renderHook(() => useChannelSearch('token'));
    await act(async () => { await hook.current.search('first', 25); });
    expect(hook.current.results).toHaveLength(1);

    act(() => { hook.current.search('second', 25); });
    await waitFor(() => expect(hook.current.loading).toBe(true));
    expect(hook.current.results).toEqual([]);
  });
});
