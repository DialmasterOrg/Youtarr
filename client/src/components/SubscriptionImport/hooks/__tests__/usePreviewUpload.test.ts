import { renderHook, act, waitFor } from '@testing-library/react';
import { usePreviewUpload } from '../usePreviewUpload';
import { PreviewResponse } from '../../../../types/subscriptionImport';

jest.mock('axios', () => {
  const post = jest.fn();
  class AxiosError extends Error {
    response?: { data?: { error?: string; details?: string } };
    constructor(message: string, response?: AxiosError['response']) {
      super(message);
      this.name = 'AxiosError';
      this.response = response;
    }
  }
  return {
    __esModule: true,
    default: { post },
    post,
    AxiosError,
  };
});

const axios = require('axios');
const { AxiosError } = axios;

const mockPreview: PreviewResponse = {
  source: 'takeout',
  totalFound: 2,
  alreadySubscribedCount: 0,
  channels: [
    { channelId: 'UC1', title: 'A', url: 'https://yt/a', thumbnailUrl: null, alreadySubscribed: false },
    { channelId: 'UC2', title: 'B', url: 'https://yt/b', thumbnailUrl: null, alreadySubscribed: false },
  ],
};

const makeFile = () => new File(['contents'], 'subs.csv', { type: 'text/csv' });

describe('usePreviewUpload', () => {
  const token = 'tok';

  test('posts to takeout endpoint and returns preview data', async () => {
    axios.post.mockResolvedValueOnce({ data: mockPreview });

    const { result } = renderHook(() => usePreviewUpload(token));

    let returned: PreviewResponse | undefined;
    await act(async () => {
      returned = await result.current.upload('takeout', makeFile());
    });

    expect(returned).toEqual(mockPreview);
    expect(axios.post).toHaveBeenCalledWith(
      '/api/subscriptions/preview/takeout',
      expect.any(FormData),
      { headers: { 'x-access-token': token, 'Content-Type': 'multipart/form-data' } }
    );
    const formData = axios.post.mock.calls[0][1] as FormData;
    expect(formData.get('file')).toBeInstanceOf(File);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  test('posts to cookies endpoint when source is cookies', async () => {
    axios.post.mockResolvedValueOnce({ data: { ...mockPreview, source: 'cookies' } });

    const { result } = renderHook(() => usePreviewUpload(token));

    await act(async () => {
      await result.current.upload('cookies', makeFile());
    });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/subscriptions/preview/cookies',
      expect.any(FormData),
      expect.any(Object)
    );
  });

  test('toggles loading during the upload', async () => {
    let resolvePost!: (v: { data: PreviewResponse }) => void;
    axios.post.mockReturnValueOnce(
      new Promise<{ data: PreviewResponse }>((resolve) => {
        resolvePost = resolve;
      })
    );

    const { result } = renderHook(() => usePreviewUpload(token));

    let promise!: Promise<PreviewResponse>;
    act(() => {
      promise = result.current.upload('takeout', makeFile());
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      resolvePost({ data: mockPreview });
      await promise;
    });

    expect(result.current.loading).toBe(false);
  });

  test('extracts error and details from AxiosError response data', async () => {
    const err = new AxiosError('Request failed', {
      data: { error: 'Invalid file', details: 'CSV header mismatch' },
    });
    axios.post.mockRejectedValueOnce(err);

    const { result } = renderHook(() => usePreviewUpload(token));

    await act(async () => {
      await expect(result.current.upload('takeout', makeFile())).rejects.toThrow('Invalid file');
    });

    expect(result.current.error).toEqual({
      message: 'Invalid file',
      details: 'CSV header mismatch',
    });
  });

  test('falls back to AxiosError message when response has no error field', async () => {
    const err = new AxiosError('Network down', { data: {} });
    axios.post.mockRejectedValueOnce(err);

    const { result } = renderHook(() => usePreviewUpload(token));

    await act(async () => {
      await expect(result.current.upload('takeout', makeFile())).rejects.toThrow('Network down');
    });

    expect(result.current.error?.message).toBe('Network down');
    expect(result.current.error?.details).toBeUndefined();
  });

  test('uses generic Error message when not an AxiosError', async () => {
    axios.post.mockRejectedValueOnce(new Error('Generic boom'));

    const { result } = renderHook(() => usePreviewUpload(token));

    await act(async () => {
      await expect(result.current.upload('takeout', makeFile())).rejects.toThrow('Generic boom');
    });

    expect(result.current.error).toEqual({ message: 'Generic boom', details: undefined });
  });

  test('uses default message when error is not an Error instance', async () => {
    axios.post.mockRejectedValueOnce('string');

    const { result } = renderHook(() => usePreviewUpload(token));

    await act(async () => {
      await expect(result.current.upload('takeout', makeFile())).rejects.toThrow('Upload failed');
    });

    expect(result.current.error?.message).toBe('Upload failed');
  });

  test('clears prior error on a new successful upload', async () => {
    axios.post.mockRejectedValueOnce(new Error('first failure'));
    const { result } = renderHook(() => usePreviewUpload(token));

    await act(async () => {
      await expect(result.current.upload('takeout', makeFile())).rejects.toThrow('first failure');
    });
    expect(result.current.error).not.toBeNull();

    axios.post.mockResolvedValueOnce({ data: mockPreview });
    await act(async () => {
      await result.current.upload('takeout', makeFile());
    });

    expect(result.current.error).toBeNull();
  });
});
