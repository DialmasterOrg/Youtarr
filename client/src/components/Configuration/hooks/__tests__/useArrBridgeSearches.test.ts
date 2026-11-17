import { act, renderHook, waitFor } from '@testing-library/react';
import { useArrBridgeSearches } from '../useArrBridgeSearches';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

const axios = require('axios');

const SEARCH = {
  id: 1,
  at: '2025-06-10T10:00:00.000Z',
  firstAt: '2025-06-10T10:00:00.000Z',
  count: 1,
  kind: 'tv',
  shape: 'episode',
  asked: { text: 'Beyblade', textSource: 'title', season: 1, episode: 29, year: null, month: null, day: null, limit: 100 },
  outcome: 'nothing',
  offered: 0,
  note: null,
  titleStageSkipped: 'no-connection',
  stages: [],
};

describe('useArrBridgeSearches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: { searches: [SEARCH] } });
  });

  test('loads the searches with the session token', async () => {
    const { result } = renderHook(() => useArrBridgeSearches('session', true));

    await waitFor(() => expect(result.current.searches).toEqual([SEARCH]));

    expect(axios.get).toHaveBeenCalledWith('/api/arr-bridge/searches', { headers: { 'x-access-token': 'session' } });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('does not load while the bridge is off or without a session', () => {
    renderHook(() => useArrBridgeSearches('session', false));
    renderHook(() => useArrBridgeSearches(null, true));

    expect(axios.get).not.toHaveBeenCalled();
  });

  test('refresh loads the list again', async () => {
    const { result } = renderHook(() => useArrBridgeSearches('session', true));
    await waitFor(() => expect(result.current.searches).toHaveLength(1));
    axios.get.mockResolvedValue({ data: { searches: [{ ...SEARCH, id: 2 }, SEARCH] } });

    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.searches).toHaveLength(2));
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test('reports a list that cannot be loaded', async () => {
    axios.get.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useArrBridgeSearches('session', true));

    await waitFor(() => expect(result.current.error).toBe('Could not load the recent searches.'));
    expect(result.current.searches).toEqual([]);
  });

  test('an answer without a list reads as empty', async () => {
    axios.get.mockResolvedValue({ data: {} });

    const { result } = renderHook(() => useArrBridgeSearches('session', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.searches).toEqual([]);
  });

  test('ignores an answer that arrives after unmounting', async () => {
    let respond: (value: unknown) => void = () => {};
    axios.get.mockReturnValue(new Promise((resolve) => { respond = resolve; }));
    const { result, unmount } = renderHook(() => useArrBridgeSearches('session', true));

    unmount();
    await act(async () => {
      respond({ data: { searches: [SEARCH] } });
    });

    expect(result.current.searches).toEqual([]);
  });
});
