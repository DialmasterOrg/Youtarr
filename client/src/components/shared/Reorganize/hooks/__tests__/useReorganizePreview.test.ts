import { renderHook, waitFor, act } from '@testing-library/react';
import { useReorganizePreview, BLOCKED_RECHECK_MS } from '../useReorganizePreview';

jest.mock('axios', () => ({
  post: jest.fn(),
  isAxiosError: (err: unknown): boolean => typeof err === 'object' && err !== null && 'response' in err,
}));

const axios = require('axios');

const CHANGE = { type: 'channelLayout' as const, channelId: 'UC1', layout: 'tv' as const };
const PREVIEW = { revision: 'rev', needed: true };

describe('useReorganizePreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('previews the change', async () => {
    axios.post.mockResolvedValueOnce({ data: PREVIEW });

    const { result } = renderHook(() => useReorganizePreview('token', CHANGE));

    await waitFor(() => expect(result.current.preview).toEqual(PREVIEW));
    expect(axios.post).toHaveBeenCalledWith('/api/tv/reorganize/preview', { change: CHANGE }, { headers: { 'x-access-token': 'token' } });
    expect(result.current.loading).toBe(false);
  });

  test('does nothing without a change', () => {
    renderHook(() => useReorganizePreview('token', null));
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('shows the server\'s refusal', async () => {
    axios.post.mockRejectedValueOnce({ response: { status: 400, data: { error: 'Nothing to move' } } });

    const { result } = renderHook(() => useReorganizePreview('token', CHANGE));

    await waitFor(() => expect(result.current.error).toBe('Nothing to move'));
    expect(result.current.preview).toBeNull();
  });

  test('previews again on refresh', async () => {
    axios.post.mockResolvedValueOnce({ data: PREVIEW }).mockResolvedValueOnce({ data: { ...PREVIEW, revision: 'rev2' } });
    const { result } = renderHook(() => useReorganizePreview('token', CHANGE));
    await waitFor(() => expect(result.current.preview).toEqual(PREVIEW));

    await act(async () => { await result.current.refresh(); });

    expect(result.current.preview).toEqual({ ...PREVIEW, revision: 'rev2' });
  });

  describe('a preview held up by a running task', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    test('is computed again until the task ends', async () => {
      axios.post
        .mockResolvedValueOnce({ data: { ...PREVIEW, blocked: { reason: 'task-running', message: 'A sync is running.' } } })
        .mockResolvedValueOnce({ data: { ...PREVIEW, blocked: null } });
      const { result } = renderHook(() => useReorganizePreview('token', CHANGE));
      await waitFor(() => expect(result.current.preview?.blocked).toBeTruthy());

      await act(async () => { jest.advanceTimersByTime(BLOCKED_RECHECK_MS); });

      await waitFor(() => expect(result.current.preview?.blocked).toBeNull());
      expect(axios.post).toHaveBeenCalledTimes(2);
      expect(result.current.loading).toBe(false);
    });

    test('is not computed again when no video could be planned', async () => {
      axios.post.mockResolvedValueOnce({ data: { ...PREVIEW, blocked: { reason: 'problems', message: 'Nothing can move.' } } });
      const { result } = renderHook(() => useReorganizePreview('token', CHANGE));
      await waitFor(() => expect(result.current.preview?.blocked).toBeTruthy());

      await act(async () => { jest.advanceTimersByTime(BLOCKED_RECHECK_MS * 3); });

      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    test('keeps the preview when a recheck fails', async () => {
      const blocked = { ...PREVIEW, blocked: { reason: 'task-running', message: 'A sync is running.' } };
      axios.post
        .mockResolvedValueOnce({ data: blocked })
        .mockRejectedValueOnce({ response: { status: 500, data: { error: 'boom' } } });
      const { result } = renderHook(() => useReorganizePreview('token', CHANGE));
      await waitFor(() => expect(result.current.preview).toEqual(blocked));

      await act(async () => { jest.advanceTimersByTime(BLOCKED_RECHECK_MS); });

      await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2));
      expect(result.current.preview).toEqual(blocked);
      expect(result.current.error).toBeNull();
    });

    test('is computed again after a failed recheck', async () => {
      const blocked = { ...PREVIEW, blocked: { reason: 'task-running', message: 'A sync is running.' } };
      axios.post
        .mockResolvedValueOnce({ data: blocked })
        .mockRejectedValueOnce({ response: { status: 500, data: { error: 'boom' } } })
        .mockResolvedValueOnce({ data: { ...PREVIEW, blocked: null } });
      const { result } = renderHook(() => useReorganizePreview('token', CHANGE));
      await waitFor(() => expect(result.current.preview).toEqual(blocked));

      await act(async () => { jest.advanceTimersByTime(BLOCKED_RECHECK_MS); });
      await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2));
      await act(async () => { jest.advanceTimersByTime(BLOCKED_RECHECK_MS); });

      await waitFor(() => expect(result.current.preview?.blocked).toBeNull());
      expect(axios.post).toHaveBeenCalledTimes(3);
    });
  });
});
