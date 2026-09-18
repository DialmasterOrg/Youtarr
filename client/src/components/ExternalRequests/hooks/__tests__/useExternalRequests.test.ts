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
    mockedAxios.get.mockResolvedValueOnce({ data: { ...page(0), data: [] } });
    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.page).toBe(1));
    expect(mockedAxios.get.mock.calls[1][0]).toBe("/api/external-requests");
    expect(mockedAxios.get.mock.calls[1][1].params).toEqual(expect.objectContaining({ page: 3, pageSize: 25 }));
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
