import { act, renderHook, waitFor } from '@testing-library/react';
import { useArrBridgeGrabs } from '../useArrBridgeGrabs';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

const axios = require('axios');

const GRAB = {
  id: 'g1',
  releaseTitle: 'Beyblade.S01E29.1080p.WEB-DL-BEYBLADEOfficial',
  youtubeId: 'g7VYYfoNaf0',
  videoTitle: 'BEYBLADE EN Episode 29',
  channelName: 'BEYBLADE Official',
  kind: 'tv',
  category: 'tv',
  state: 'ready',
  failMessage: null,
  createdAt: '2025-06-10T10:00:00.000Z',
  completedAt: '2025-06-10T10:05:00.000Z',
  removedAt: null,
};

describe('useArrBridgeGrabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: { grabs: [GRAB] } });
  });

  test('loads the grabs with the session token', async () => {
    const { result } = renderHook(() => useArrBridgeGrabs('session', true));

    await waitFor(() => expect(result.current.grabs).toEqual([GRAB]));

    expect(axios.get).toHaveBeenCalledWith('/api/arr-bridge/grabs', { headers: { 'x-access-token': 'session' } });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('does not load while the bridge is off or without a session', () => {
    renderHook(() => useArrBridgeGrabs('session', false));
    renderHook(() => useArrBridgeGrabs(null, true));

    expect(axios.get).not.toHaveBeenCalled();
  });

  test('refresh loads the list again', async () => {
    const { result } = renderHook(() => useArrBridgeGrabs('session', true));
    await waitFor(() => expect(result.current.grabs).toHaveLength(1));
    axios.get.mockResolvedValue({ data: { grabs: [GRAB, { ...GRAB, id: 'g2' }] } });

    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.grabs).toHaveLength(2));
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test('reports a list that cannot be loaded', async () => {
    axios.get.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useArrBridgeGrabs('session', true));

    await waitFor(() => expect(result.current.error).toBe('Could not load the recent grabs.'));
    expect(result.current.grabs).toEqual([]);
  });

  test('an answer without a list reads as empty', async () => {
    axios.get.mockResolvedValue({ data: {} });

    const { result } = renderHook(() => useArrBridgeGrabs('session', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.grabs).toEqual([]);
  });

  test('ignores an answer that arrives after unmounting', async () => {
    let respond: (value: unknown) => void = () => {};
    axios.get.mockReturnValue(new Promise((resolve) => { respond = resolve; }));
    const { result, unmount } = renderHook(() => useArrBridgeGrabs('session', true));

    unmount();
    await act(async () => {
      respond({ data: { grabs: [GRAB] } });
    });

    expect(result.current.grabs).toEqual([]);
  });
});
