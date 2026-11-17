import { act, renderHook, waitFor } from '@testing-library/react';
import { useArrBridgeKey } from '../useArrBridgeKey';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const axios = require('axios');

const KEY = 'a'.repeat(64);
const NEW_KEY = 'b'.repeat(64);

describe('useArrBridgeKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: { key: KEY } });
    axios.post.mockResolvedValue({ data: { key: NEW_KEY } });
  });

  test('loads the key with the session token', async () => {
    const { result } = renderHook(() => useArrBridgeKey('session', true));

    await waitFor(() => expect(result.current.bridgeKey).toBe(KEY));

    expect(axios.get).toHaveBeenCalledWith('/api/arr-bridge/key', { headers: { 'x-access-token': 'session' } });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('does not ask for the key while the bridge is off, because the server would create one', () => {
    renderHook(() => useArrBridgeKey('session', false));

    expect(axios.get).not.toHaveBeenCalled();
  });

  test('does not ask for the key without a session', () => {
    renderHook(() => useArrBridgeKey(null, true));

    expect(axios.get).not.toHaveBeenCalled();
  });

  test('loads the key once the bridge is turned on', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useArrBridgeKey('session', enabled),
      { initialProps: { enabled: false } }
    );

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.bridgeKey).toBe(KEY));
  });

  test('reports a key that cannot be loaded', async () => {
    axios.get.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useArrBridgeKey('session', true));

    await waitFor(() => expect(result.current.error).toBe('Could not load the key.'));
    expect(result.current.bridgeKey).toBeNull();
  });

  test('regenerate replaces the key', async () => {
    const { result } = renderHook(() => useArrBridgeKey('session', true));
    await waitFor(() => expect(result.current.bridgeKey).toBe(KEY));

    let succeeded = false;
    await act(async () => {
      succeeded = await result.current.regenerate();
    });

    expect(succeeded).toBe(true);
    expect(result.current.bridgeKey).toBe(NEW_KEY);
    expect(axios.post).toHaveBeenCalledWith('/api/arr-bridge/key/regenerate', null, {
      headers: { 'x-access-token': 'session' },
    });
  });

  test('a failed regenerate keeps the current key', async () => {
    axios.post.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useArrBridgeKey('session', true));
    await waitFor(() => expect(result.current.bridgeKey).toBe(KEY));

    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.regenerate();
    });

    expect(succeeded).toBe(false);
    expect(result.current.bridgeKey).toBe(KEY);
    expect(result.current.regenerating).toBe(false);
  });
});
