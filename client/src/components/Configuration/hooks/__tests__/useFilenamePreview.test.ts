import { renderHook, act, waitFor } from '@testing-library/react';

jest.mock('axios', () => ({
  post: jest.fn(),
}));

const axios = require('axios');

import { useFilenamePreview } from '../useFilenamePreview';

const SAMPLE_RESPONSE = {
  fileLine: 'TEDx Talks - Sample [Hu4Yvq-g7_Y].mp4',
  folderLine: 'TEDx Talks - Sample - Hu4Yvq-g7_Y',
  fileLineLength: 38,
  folderLineLength: 33,
};

describe('useFilenamePreview', () => {
  beforeEach(() => jest.clearAllMocks());

  test('initial state: no data, not loading, no error', () => {
    const { result } = renderHook(() => useFilenamePreview('tok'));
    expect(result.current.data).toBeNull();
    expect(result.current.previewedPrefix).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('run() posts the prefix and the auth token to /api/config/filename-preview', async () => {
    axios.post.mockResolvedValueOnce({ data: SAMPLE_RESPONSE });

    const { result } = renderHook(() => useFilenamePreview('tok-abc'));

    await act(async () => {
      await result.current.run('%(title).76B');
    });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/config/filename-preview',
      { prefix: '%(title).76B' },
      { headers: { 'x-access-token': 'tok-abc' } }
    );
    await waitFor(() => {
      expect(result.current.data).toEqual(SAMPLE_RESPONSE);
    });
    expect(result.current.previewedPrefix).toBe('%(title).76B');
  });

  test('surfaces yt-dlp grammar error from a 400 response verbatim', async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: {
          error:
            'Template rejected by yt-dlp: yt-dlp: error: invalid default output template "%(title)Z": unsupported format character \'Z\' (0x5a) at index 8',
        },
      },
    });

    const { result } = renderHook(() => useFilenamePreview('tok'));

    await act(async () => {
      await result.current.run('%(title)Z');
    });

    await waitFor(() => {
      expect(result.current.error).toMatch(/unsupported format character/);
    });
  });

  test('falls back to a generic error on network failure', async () => {
    axios.post.mockRejectedValueOnce(new Error('Network Error'));

    const { result } = renderHook(() => useFilenamePreview('tok'));

    await act(async () => {
      await result.current.run('%(title).76B');
    });

    await waitFor(() => {
      expect(result.current.error).toMatch(/preview failed/i);
    });
  });

  test('isStale flips true when the prefix changes after a successful run', async () => {
    axios.post.mockResolvedValueOnce({ data: SAMPLE_RESPONSE });

    const { result } = renderHook(() => useFilenamePreview('tok'));

    await act(async () => {
      await result.current.run('%(title).76B');
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(SAMPLE_RESPONSE);
    });

    expect(result.current.isStale('%(title).76B')).toBe(false);
    expect(result.current.isStale('%(title).100B')).toBe(true);
  });

  test('isStale stays false before any successful run', () => {
    const { result } = renderHook(() => useFilenamePreview('tok'));
    expect(result.current.isStale('anything')).toBe(false);
  });

  test('clears prior error before each new run', async () => {
    axios.post
      .mockRejectedValueOnce({
        response: { status: 400, data: { error: 'first error' } },
      })
      .mockResolvedValueOnce({ data: SAMPLE_RESPONSE });

    const { result } = renderHook(() => useFilenamePreview('tok'));

    await act(async () => {
      await result.current.run('%(title)Z');
    });
    await waitFor(() => {
      expect(result.current.error).toBe('first error');
    });

    await act(async () => {
      await result.current.run('%(title).76B');
    });
    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
    expect(result.current.data).toEqual(SAMPLE_RESPONSE);
  });

  test('preserves prior successful data when a subsequent call fails', async () => {
    axios.post
      .mockResolvedValueOnce({ data: SAMPLE_RESPONSE })
      .mockRejectedValueOnce({
        response: { status: 400, data: { error: 'bad template' } },
      });

    const { result } = renderHook(() => useFilenamePreview('tok'));

    await act(async () => {
      await result.current.run('%(title).76B');
    });
    await act(async () => {
      await result.current.run('%(title)Z');
    });

    await waitFor(() => {
      expect(result.current.error).toBe('bad template');
    });
    expect(result.current.data).toEqual(SAMPLE_RESPONSE);
  });
});
