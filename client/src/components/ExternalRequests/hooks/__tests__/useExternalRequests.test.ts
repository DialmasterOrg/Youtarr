import { renderHook, waitFor, act } from '@testing-library/react';
import axios from 'axios';
import { useExternalRequests } from '../useExternalRequests';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  isAxiosError: (error: unknown) => Boolean((error as { response?: unknown })?.response),
  isCancel: () => false,
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const request = { id: 'request-1', type: 'channel' as const, status: 'pending' as const, requester: null, target: { youtubeId: null, channelId: null, channelUrl: 'https://www.youtube.com/@safechannel', youtubeChannelId: null, channelTitle: null, title: null, mediaType: 'channel', rating: null, contentRating: null }, job: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
const page = (totalPages = 1) => ({ data: [request], pagination: { page: 1, pageSize: 25, total: 1, totalPages }, filterOptions: { requesters: [] } });

describe('useExternalRequests', () => {
  beforeEach(() => { mockedAxios.get.mockReset(); mockedAxios.post.mockReset(); });
  it('loads typed queue data and clamps a page removed by a mutation', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: page(1) });
    const { result } = renderHook(() => useExternalRequests('token'));
    await waitFor(() => expect(result.current.requests).toHaveLength(1));
    mockedAxios.get.mockResolvedValue({ data: { ...page(0), data: [] } });
    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.page).toBe(1));
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      2,
      '/api/external-requests',
      expect.objectContaining({ params: expect.objectContaining({ page: 3, pageSize: 25 }) })
    );
  });
  it('treats a filter change after a background poll as a normal load', async () => {
    jest.useFakeTimers();
    try {
      const inFlight = { ...request, status: 'processing' as const };
      mockedAxios.get.mockResolvedValue({ data: { ...page(), data: [inFlight] } });
      const { result } = renderHook(() => useExternalRequests('token'));
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => { jest.advanceTimersByTime(5000); });
      await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(2));

      let rejectLoad: (reason: unknown) => void = () => undefined;
      mockedAxios.get.mockImplementationOnce(() => new Promise((_, reject) => { rejectLoad = reject; }));
      act(() => result.current.setFilter('status', 'pending'));
      expect(result.current.loading).toBe(true);

      await act(async () => { rejectLoad({ response: { status: 500, data: { error: 'boom' } } }); });
      await waitFor(() => expect(result.current.error).not.toBeNull());
      expect(result.current.loading).toBe(false);
    } finally {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    }
  });
  it('resets the channel grant choice for every new inline action', async () => {
    mockedAxios.get.mockResolvedValue({ data: page() });
    const { result } = renderHook(() => useExternalRequests('token'));
    await waitFor(() => expect(result.current.requests).toHaveLength(1));
    act(() => result.current.setGrantToRequestingKey(false));
    act(() => result.current.beginInlineAction(request, 'approve'));
    expect(result.current.grantToRequestingKey).toBe(true);
    act(() => result.current.cancelAction());
    expect(result.current.selected).toBeNull();
    expect(result.current.action).toBeNull();
  });
});
