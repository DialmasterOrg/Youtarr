import { renderHook, waitFor, act } from '@testing-library/react';
import { useReorganizePreview } from '../useReorganizePreview';

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
});
