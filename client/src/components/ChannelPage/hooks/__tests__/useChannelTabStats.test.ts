import { renderHook, waitFor, act } from '@testing-library/react';
import { useChannelTabStats } from '../useChannelTabStats';

jest.mock('axios', () => ({
  get: jest.fn(),
  isAxiosError: jest.fn(() => false),
}));

const axios = require('axios');

const TABS = { videos: { total: 10, fetchedAt: null, downloaded: 5, ignored: 0, percent: 50, loaded: 8 } };

beforeEach(() => {
  jest.clearAllMocks();
});

test('loads the tab stats for the channel', async () => {
  axios.get.mockResolvedValue({ data: { channelId: 'UC1', tabs: TABS } });

  const { result } = renderHook(() => useChannelTabStats('UC1', 'token-1'));

  await waitFor(() => expect(result.current.data).toEqual(TABS));
});

test('sends the auth header', async () => {
  axios.get.mockResolvedValue({ data: { channelId: 'UC1', tabs: TABS } });

  renderHook(() => useChannelTabStats('UC1', 'token-1'));

  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(
    '/api/channels/UC1/tab-stats',
    { headers: { 'x-access-token': 'token-1' } }
  ));
});

test('does not fetch without a token', () => {
  renderHook(() => useChannelTabStats('UC1', null));

  expect(axios.get).not.toHaveBeenCalled();
});

test('reports an error when the request fails', async () => {
  axios.get.mockRejectedValue(new Error('network'));

  const { result } = renderHook(() => useChannelTabStats('UC1', 'token-1'));

  await waitFor(() => expect(result.current.error).toBe('Could not load download stats'));
});

test('ignores a slower response for a channel the page has moved away from', async () => {
  const OTHER_TABS = { videos: { total: 99, fetchedAt: null, downloaded: 1, ignored: 0, percent: 1, loaded: 2 } };
  let resolveFirst: (value: unknown) => void = () => undefined;
  axios.get
    .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
    .mockResolvedValueOnce({ data: { channelId: 'UC2', tabs: TABS } });
  const { result, rerender } = renderHook(
    ({ channelId }: { channelId: string }) => useChannelTabStats(channelId, 'token-1'),
    { initialProps: { channelId: 'UC1' } }
  );

  rerender({ channelId: 'UC2' });
  await waitFor(() => expect(result.current.data).toEqual(TABS));
  await act(async () => {
    resolveFirst({ data: { channelId: 'UC1', tabs: OTHER_TABS } });
  });

  expect(result.current.data).toEqual(TABS);
});

test('refetch loads the stats again', async () => {
  axios.get.mockResolvedValue({ data: { channelId: 'UC1', tabs: TABS } });
  const { result } = renderHook(() => useChannelTabStats('UC1', 'token-1'));
  await waitFor(() => expect(result.current.data).toEqual(TABS));

  await act(async () => {
    await result.current.refetch();
  });

  expect(axios.get).toHaveBeenCalledTimes(2);
});
