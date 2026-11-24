import { renderHook, waitFor } from '@testing-library/react';
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
  });

  test('loads a page of grabs and how many there are', async () => {
    axios.get.mockResolvedValue({ data: { grabs: [GRAB], total: 14, page: 1, pageSize: 10 } });

    const { result } = renderHook(() => useArrBridgeGrabs('session', true));

    await waitFor(() => expect(result.current.items).toEqual([GRAB]));
    expect(result.current.total).toBe(14);
    expect(axios.get).toHaveBeenCalledWith('/api/arr-bridge/grabs', {
      headers: { 'x-access-token': 'session' },
      params: { page: 1, pageSize: 10 },
    });
  });

  test('reports a list that cannot be loaded', async () => {
    axios.get.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useArrBridgeGrabs('session', true));

    await waitFor(() => expect(result.current.error).toBe('Could not load the recent grabs.'));
  });
});
