import { renderHook, waitFor } from '@testing-library/react';
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
  });

  test('loads a page of searches and how many there are', async () => {
    axios.get.mockResolvedValue({ data: { searches: [SEARCH], total: 14, page: 1, pageSize: 10 } });

    const { result } = renderHook(() => useArrBridgeSearches('session', true));

    await waitFor(() => expect(result.current.items).toEqual([SEARCH]));
    expect(result.current.total).toBe(14);
    expect(axios.get).toHaveBeenCalledWith('/api/arr-bridge/searches', {
      headers: { 'x-access-token': 'session' },
      params: { page: 1, pageSize: 10 },
    });
  });

  test('reports a list that cannot be loaded', async () => {
    axios.get.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useArrBridgeSearches('session', true));

    await waitFor(() => expect(result.current.error).toBe('Could not load the recent searches.'));
  });
});
