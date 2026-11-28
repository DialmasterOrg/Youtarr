import { act, renderHook, waitFor } from '@testing-library/react';
import { useArrBridgeKey } from '../useArrBridgeKey';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const axios = require('axios');

describe('useArrBridgeKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: { key: 'bridge-key' } });
    axios.post.mockResolvedValue({ data: { key: 'new-bridge-key' } });
  });

  test('loads the key from the bridge endpoint', async () => {
    const { result } = renderHook(() => useArrBridgeKey('session', true));

    await waitFor(() => expect(result.current.bridgeKey).toBe('bridge-key'));
    expect(axios.get).toHaveBeenCalledWith('/api/arr-bridge/key', { headers: { 'x-access-token': 'session' } });
  });

  test('replaces the key through the bridge endpoint', async () => {
    const { result } = renderHook(() => useArrBridgeKey('session', true));
    await waitFor(() => expect(result.current.bridgeKey).toBe('bridge-key'));

    await act(async () => { await result.current.regenerate(); });

    expect(axios.post).toHaveBeenCalledWith('/api/arr-bridge/key/regenerate', null, {
      headers: { 'x-access-token': 'session' },
    });
    expect(result.current.bridgeKey).toBe('new-bridge-key');
  });

  test('says the key could not be loaded', async () => {
    axios.get.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useArrBridgeKey('session', true));

    await waitFor(() => expect(result.current.error).toBe('Could not load the key.'));
  });
});
