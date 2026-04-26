import { renderHook, act, waitFor } from '@testing-library/react';

jest.mock('axios', () => ({
  post: jest.fn(),
  isAxiosError: (err: unknown): boolean =>
    typeof err === 'object' && err !== null && (err as { isAxiosError?: boolean }).isAxiosError === true,
}));

import axios from 'axios';
import { useYouTubeApiKey } from '../useYouTubeApiKey';

const mockedAxiosPost = axios.post as jest.MockedFunction<typeof axios.post>;

describe('useYouTubeApiKey', () => {
  const setSnackbar = jest.fn();
  const setInitialConfig = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  test('starts in not_tested status', () => {
    const { result } = renderHook(() =>
      useYouTubeApiKey({ token: 't', apiKey: '', setInitialConfig, setSnackbar })
    );
    expect(result.current.status).toBe('not_tested');
  });

  test('transitions to testing -> valid on success', async () => {
    mockedAxiosPost.mockResolvedValueOnce({ data: { ok: true } });

    const { result } = renderHook(() =>
      useYouTubeApiKey({ token: 't', apiKey: 'key', setInitialConfig, setSnackbar })
    );

    await act(async () => {
      await result.current.testKey();
    });

    expect(mockedAxiosPost).toHaveBeenCalledWith(
      '/testYoutubeApiKey',
      { apiKey: 'key' },
      expect.objectContaining({ headers: { 'x-access-token': 't' } })
    );
    await waitFor(() => expect(result.current.status).toBe('valid'));
    expect(result.current.lastValidatedAt).not.toBeNull();
  });

  test('sets invalid status and shows snackbar on KEY_INVALID', async () => {
    mockedAxiosPost.mockResolvedValueOnce({
      data: { ok: false, code: 'KEY_INVALID', reason: 'invalid key' },
    });

    const { result } = renderHook(() =>
      useYouTubeApiKey({ token: 't', apiKey: 'bad', setInitialConfig, setSnackbar })
    );

    await act(async () => {
      await result.current.testKey();
    });

    await waitFor(() => expect(result.current.status).toBe('invalid'));
    expect(setSnackbar).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  test('maps QUOTA_EXCEEDED to quota_exhausted status', async () => {
    mockedAxiosPost.mockResolvedValueOnce({
      data: { ok: false, code: 'QUOTA_EXCEEDED', reason: 'quota exhausted' },
    });

    const { result } = renderHook(() =>
      useYouTubeApiKey({ token: 't', apiKey: 'k', setInitialConfig, setSnackbar })
    );

    await act(async () => {
      await result.current.testKey();
    });

    await waitFor(() => expect(result.current.status).toBe('quota_exhausted'));
  });

  test('maps RATE_LIMITED to rate_limited status', async () => {
    mockedAxiosPost.mockResolvedValueOnce({
      data: { ok: false, code: 'RATE_LIMITED', reason: 'slow down' },
    });

    const { result } = renderHook(() =>
      useYouTubeApiKey({ token: 't', apiKey: 'k', setInitialConfig, setSnackbar })
    );

    await act(async () => {
      await result.current.testKey();
    });

    await waitFor(() => expect(result.current.status).toBe('rate_limited'));
  });

  test('maps API_NOT_ENABLED to api_not_enabled status', async () => {
    mockedAxiosPost.mockResolvedValueOnce({
      data: { ok: false, code: 'API_NOT_ENABLED', reason: 'enable it' },
    });

    const { result } = renderHook(() =>
      useYouTubeApiKey({ token: 't', apiKey: 'k', setInitialConfig, setSnackbar })
    );

    await act(async () => {
      await result.current.testKey();
    });

    await waitFor(() => expect(result.current.status).toBe('api_not_enabled'));
  });

  test('warns and does nothing when apiKey is empty', async () => {
    const { result } = renderHook(() =>
      useYouTubeApiKey({ token: 't', apiKey: '', setInitialConfig, setSnackbar })
    );

    await act(async () => {
      await result.current.testKey();
    });

    expect(mockedAxiosPost).not.toHaveBeenCalled();
    expect(setSnackbar).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warning' }));
  });

  test('sets network_error status on axios throw', async () => {
    mockedAxiosPost.mockRejectedValueOnce(new Error('net down'));

    const { result } = renderHook(() =>
      useYouTubeApiKey({ token: 't', apiKey: 'k', setInitialConfig, setSnackbar })
    );

    await act(async () => {
      await result.current.testKey();
    });

    await waitFor(() => expect(result.current.status).toBe('network_error'));
  });

  test('shows the server message and rate_limited status on 429', async () => {
    mockedAxiosPost.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 429,
        data: { error: 'Too many key tests. Please wait a minute before trying again.' },
      },
    });

    const { result } = renderHook(() =>
      useYouTubeApiKey({ token: 't', apiKey: 'k', setInitialConfig, setSnackbar })
    );

    await act(async () => {
      await result.current.testKey();
    });

    await waitFor(() => expect(result.current.status).toBe('rate_limited'));
    expect(result.current.lastReason).toBe('Too many key tests. Please wait a minute before trying again.');
    expect(setSnackbar).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'error',
      message: 'Too many key tests. Please wait a minute before trying again.',
    }));
  });

  test('clear() resets to not_tested', async () => {
    mockedAxiosPost.mockResolvedValueOnce({ data: { ok: true } });

    const { result } = renderHook(() =>
      useYouTubeApiKey({ token: 't', apiKey: 'k', setInitialConfig, setSnackbar })
    );

    await act(async () => {
      await result.current.testKey();
    });
    await waitFor(() => expect(result.current.status).toBe('valid'));

    act(() => {
      result.current.clear();
    });

    expect(result.current.status).toBe('not_tested');
    expect(result.current.lastValidatedAt).toBeNull();
    expect(result.current.lastReason).toBeNull();
  });
});
