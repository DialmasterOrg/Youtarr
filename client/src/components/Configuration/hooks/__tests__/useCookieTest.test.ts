import { renderHook, act, waitFor } from '@testing-library/react';

jest.mock('axios', () => ({
  post: jest.fn(),
  isAxiosError: (err: unknown): boolean =>
    typeof err === 'object' && err !== null && (err as { isAxiosError?: boolean }).isAxiosError === true,
}));

import axios from 'axios';
import { useCookieTest } from '../useCookieTest';

const mockedAxiosPost = axios.post as jest.MockedFunction<typeof axios.post>;

const axiosError = (status: number, data: unknown) =>
  Object.assign(new Error('Request failed'), { isAxiosError: true, response: { status, data } });

describe('useCookieTest', () => {
  beforeEach(() => jest.clearAllMocks());

  test('starts with no result and not testing', () => {
    const { result } = renderHook(() => useCookieTest('token'));
    expect(result.current).toMatchObject({ result: null, testing: false, testedAt: null });
  });

  test('posts to the cookie test endpoint with the auth token', async () => {
    mockedAxiosPost.mockResolvedValueOnce({ data: { ok: true, message: 'Signed in.' } });
    const { result } = renderHook(() => useCookieTest('token'));

    await act(async () => { await result.current.runTest(); });

    expect(mockedAxiosPost).toHaveBeenCalledWith(
      '/api/cookies/test',
      {},
      { headers: { 'x-access-token': 'token' } }
    );
  });

  test('stores a successful result', async () => {
    mockedAxiosPost.mockResolvedValueOnce({ data: { ok: true, message: 'Signed in.' } });
    const { result } = renderHook(() => useCookieTest('token'));

    await act(async () => { await result.current.runTest(); });

    expect(result.current.result).toEqual({ ok: true, message: 'Signed in.' });
  });

  test('records when the test finished', async () => {
    mockedAxiosPost.mockResolvedValueOnce({ data: { ok: true, message: 'Signed in.' } });
    const { result } = renderHook(() => useCookieTest('token'));

    await act(async () => { await result.current.runTest(); });

    expect(result.current.testedAt).toBeInstanceOf(Date);
  });

  test('stores a failed test result from the server', async () => {
    const failure = { ok: false, code: 'EXPIRED_COOKIES', error: 'Not signed in.' };
    mockedAxiosPost.mockResolvedValueOnce({ data: failure });
    const { result } = renderHook(() => useCookieTest('token'));

    await act(async () => { await result.current.runTest(); });

    expect(result.current.result).toEqual(failure);
  });

  test('reports the server error message for a rejected request', async () => {
    mockedAxiosPost.mockRejectedValueOnce(axiosError(409, { error: 'A cookie test is already running.' }));
    const { result } = renderHook(() => useCookieTest('token'));

    await act(async () => { await result.current.runTest(); });

    expect(result.current.result).toEqual({ ok: false, error: 'A cookie test is already running.' });
  });

  test('falls back to a generic message when the request fails without one', async () => {
    mockedAxiosPost.mockRejectedValueOnce(new Error('Network Error'));
    const { result } = renderHook(() => useCookieTest('token'));

    await act(async () => { await result.current.runTest(); });

    expect(result.current.result).toEqual({ ok: false, error: expect.stringMatching(/could not run the cookie test/i) });
  });

  test('is testing while the request is pending', async () => {
    let resolveRequest: (value: unknown) => void = () => undefined;
    mockedAxiosPost.mockReturnValueOnce(new Promise((resolve) => { resolveRequest = resolve; }));
    const { result } = renderHook(() => useCookieTest('token'));

    act(() => { void result.current.runTest(); });
    await waitFor(() => expect(result.current.testing).toBe(true));

    await act(async () => { resolveRequest({ data: { ok: true, message: 'Signed in.' } }); });
    expect(result.current.testing).toBe(false);
  });
});
