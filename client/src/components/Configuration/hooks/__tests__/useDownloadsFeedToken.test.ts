import { act, renderHook, waitFor } from '@testing-library/react';
import { useDownloadsFeedToken } from '../useDownloadsFeedToken';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const axios = require('axios');

const FEED_TOKEN = 'a'.repeat(64);
const NEW_FEED_TOKEN = 'b'.repeat(64);

describe('useDownloadsFeedToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: { token: FEED_TOKEN } });
    axios.post.mockResolvedValue({ data: { token: NEW_FEED_TOKEN } });
  });

  test('loads the token with the auth token', async () => {
    const { result } = renderHook(() => useDownloadsFeedToken('session', true));

    await waitFor(() => expect(result.current.feedToken).toBe(FEED_TOKEN));

    expect(axios.get).toHaveBeenCalledWith('/api/feeds/downloads/token', {
      headers: { 'x-access-token': 'session' },
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('does not ask for a token while the feed is off, because the server would create one', () => {
    renderHook(() => useDownloadsFeedToken('session', false));

    expect(axios.get).not.toHaveBeenCalled();
  });

  test('does not ask for a token without a session', () => {
    renderHook(() => useDownloadsFeedToken(null, true));

    expect(axios.get).not.toHaveBeenCalled();
  });

  test('loads the token once the feed is turned on', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useDownloadsFeedToken('session', enabled),
      { initialProps: { enabled: false } }
    );

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.feedToken).toBe(FEED_TOKEN));
  });

  test('reports a token that cannot be loaded', async () => {
    axios.get.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useDownloadsFeedToken('session', true));

    await waitFor(() => expect(result.current.error).toBe('Could not load the feed URL.'));
    expect(result.current.feedToken).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  test('ignores a response that arrives after unmounting', async () => {
    let respond: (value: unknown) => void = () => {};
    axios.get.mockReturnValue(new Promise((resolve) => { respond = resolve; }));

    const { result, unmount } = renderHook(() => useDownloadsFeedToken('session', true));
    unmount();
    await act(async () => respond({ data: { token: FEED_TOKEN } }));

    expect(result.current.feedToken).toBeNull();
  });

  test('replaces the token', async () => {
    const { result } = renderHook(() => useDownloadsFeedToken('session', true));
    await waitFor(() => expect(result.current.feedToken).toBe(FEED_TOKEN));

    let succeeded = false;
    await act(async () => { succeeded = await result.current.regenerate(); });

    expect(axios.post).toHaveBeenCalledWith('/api/feeds/downloads/regenerate-token', null, {
      headers: { 'x-access-token': 'session' },
    });
    expect(succeeded).toBe(true);
    expect(result.current.feedToken).toBe(NEW_FEED_TOKEN);
    expect(result.current.regenerating).toBe(false);
  });

  test('keeps the current token when it cannot be replaced', async () => {
    axios.post.mockRejectedValue(new Error('disk full'));
    const { result } = renderHook(() => useDownloadsFeedToken('session', true));
    await waitFor(() => expect(result.current.feedToken).toBe(FEED_TOKEN));

    let succeeded = true;
    await act(async () => { succeeded = await result.current.regenerate(); });

    expect(succeeded).toBe(false);
    expect(result.current.feedToken).toBe(FEED_TOKEN);
    expect(result.current.regenerating).toBe(false);
  });
});
