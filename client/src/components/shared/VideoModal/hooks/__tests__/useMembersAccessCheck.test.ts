jest.mock('axios', () => ({ post: jest.fn() }));

import { act, renderHook, waitFor } from '@testing-library/react';
import { useMembersAccessCheck } from '../useMembersAccessCheck';

const axios = require('axios');

describe('useMembersAccessCheck', () => {
  beforeEach(() => jest.clearAllMocks());

  test('has no result before a check', () => {
    const { result } = renderHook(() => useMembersAccessCheck('abc123def45', 'tok'));
    expect(result.current.data).toBeUndefined();
  });

  test('returns the access state the server reports', async () => {
    axios.post.mockResolvedValueOnce({ data: { membersAccess: 'confirmed' } });
    const { result } = renderHook(() => useMembersAccessCheck('abc123def45', 'tok'));

    await act(async () => { await result.current.check(); });

    expect(result.current.data).toBe('confirmed');
  });

  test('posts to the check endpoint with the token', async () => {
    axios.post.mockResolvedValueOnce({ data: { membersAccess: 'denied' } });
    const { result } = renderHook(() => useMembersAccessCheck('abc123def45', 'tok'));

    await act(async () => { await result.current.check(); });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/videos/abc123def45/members-access/check',
      {},
      { headers: { 'x-access-token': 'tok' } }
    );
  });

  test('shows the server message when YouTube could not be asked', async () => {
    axios.post.mockRejectedValueOnce({ response: { status: 503, data: { error: 'YouTube could not be reached to check access. Try again later.' } } });
    const { result } = renderHook(() => useMembersAccessCheck('abc123def45', 'tok'));

    await act(async () => { await result.current.check(); });

    expect(result.current.error).toBe('YouTube could not be reached to check access. Try again later.');
  });

  test('explains a rate limit', async () => {
    axios.post.mockRejectedValueOnce({ response: { status: 429, data: { error: 'Too many access checks' } } });
    const { result } = renderHook(() => useMembersAccessCheck('abc123def45', 'tok'));

    await act(async () => { await result.current.check(); });

    expect(result.current.error).toMatch(/Too many checks/);
  });

  test('forgets the result when the video changes', async () => {
    axios.post.mockResolvedValueOnce({ data: { membersAccess: 'confirmed' } });
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useMembersAccessCheck(id, 'tok'),
      { initialProps: { id: 'abc123def45' } }
    );
    await act(async () => { await result.current.check(); });

    rerender({ id: 'zzz123def45' });

    await waitFor(() => expect(result.current.data).toBeUndefined());
  });

  test('does nothing without a token', async () => {
    const { result } = renderHook(() => useMembersAccessCheck('abc123def45', null));

    await act(async () => { await result.current.check(); });

    expect(axios.post).not.toHaveBeenCalled();
  });
});
