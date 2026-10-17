import { act, renderHook, waitFor } from '@testing-library/react';
import axios from 'axios';
import { useExternalRequests } from './useExternalRequests';
import { ExternalRequestReview, ExternalRequestReviewPage } from '../../../types/externalRequest';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), isCancel: () => false,
  isAxiosError: (error: unknown) => Boolean((error as { response?: unknown })?.response) }));
const api = axios as jest.Mocked<typeof axios>;
const request: ExternalRequestReview = {
  id: 'request-1', type: 'channel', status: 'pending', requester: null,
  target: { youtubeId: null, channelId: null, youtubeChannelId: null,
    channelTitle: null, title: null, mediaType: null, rating: null },
  job: null, createdAt: '', updatedAt: '',
};
const page = (data: ExternalRequestReview[]): ExternalRequestReviewPage => ({ data,
  pagination: { page: 1, pageSize: 25, total: data.length, totalPages: 1 },
  filterOptions: { requesters: [] } });
function deferred<T>() {
  let resolve!: (data: { data: T }) => void;
  const promise = new Promise<{ data: T }>(r => { resolve = r; });
  return { promise, resolve };
}
beforeEach(() => jest.clearAllMocks());

test('a late response from an old filter cannot replace the current queue', async () => {
  const previous = deferred<ExternalRequestReviewPage>();
  api.get.mockReturnValueOnce(previous.promise).mockResolvedValueOnce({ data: page([]) });
  const { result } = renderHook(() => useExternalRequests('session'));
  act(() => result.current.setFilter('status', 'rejected'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => previous.resolve({ data: page([request]) }));
  expect(result.current.requests).toEqual([]);
  expect(result.current.filters.status).toBe('rejected');
});

test('a shrinking queue clamps to its final page and fetches that page', async () => {
  api.get.mockResolvedValueOnce({ data: { ...page([request]), pagination: { page: 1, totalPages: 2 } } })
    .mockResolvedValueOnce({ data: page([]) }).mockResolvedValueOnce({ data: page([request]) });
  const { result } = renderHook(() => useExternalRequests('session'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.setPage(2));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.page).toBe(1);
  expect(result.current.requests).toEqual([request]);
});

test('duplicate submission is prevented and an approved channel retry retains a false grant', async () => {
  api.get.mockResolvedValue({ data: page([request]) });
  const pending = deferred<ExternalRequestReview>();
  api.post.mockReturnValueOnce(pending.promise);
  const { result } = renderHook(() => useExternalRequests('session'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.beginInlineAction({ ...request, status: 'approved', grantToRequestingKey: false }, 'approve'));
  act(() => { void result.current.submitAction(); void result.current.submitAction(); result.current.cancelAction(); });
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith('/api/external-requests/request-1/approve',
    { grantToRequestingKey: false }, expect.anything());
  expect(result.current.selected).not.toBeNull();
  await act(async () => pending.resolve({ data: { ...request, status: 'completed' } }));
  expect(result.current.action).toBeNull();
  expect(result.current.selected?.status).toBe('completed');
});

test('capacity errors retain the confirmation and support retry without losing its choice', async () => {
  api.get.mockResolvedValue({ data: page([request]) });
  api.post.mockRejectedValueOnce({ response: { status: 503 } })
    .mockResolvedValueOnce({ data: { ...request, status: 'completed' } });
  const { result } = renderHook(() => useExternalRequests('session'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.beginInlineAction(request, 'approve'));
  act(() => result.current.setGrantToRequestingKey(false));
  await act(async () => result.current.submitAction());
  expect(result.current.actionError).toMatch(/capacity/);
  expect(result.current.action).toBe('approve');
  await act(async () => result.current.submitAction());
  expect(api.post).toHaveBeenLastCalledWith('/api/external-requests/request-1/approve',
    { grantToRequestingKey: false }, expect.anything());
});

test('changing session discards pending details and a cancelled approval resets its grant', async () => {
  const details = deferred<ExternalRequestReview>();
  api.get.mockResolvedValueOnce({ data: page([request]) }).mockReturnValueOnce(details.promise)
    .mockResolvedValue({ data: page([]) });
  const { result, rerender } = renderHook(({ token }) => useExternalRequests(token), { initialProps: { token: 'first' } });
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => { void result.current.openDetail(request); });
  rerender({ token: 'second' });
  await act(async () => details.resolve({ data: request }));
  expect(result.current.selected).toBeNull();
  act(() => result.current.beginInlineAction(request, 'approve'));
  act(() => result.current.setGrantToRequestingKey(false));
  act(() => result.current.cancelAction());
  expect(result.current.selected).toBeNull();
  act(() => result.current.beginInlineAction(request, 'approve'));
  expect(result.current.grantToRequestingKey).toBe(true);
});
