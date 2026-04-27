import { renderHook, act, waitFor } from '@testing-library/react';

jest.mock('axios', () => ({
  post: jest.fn(),
}));

const axios = require('axios');

import { useYtdlpArgsValidation } from '../useYtdlpArgsValidation';

describe('useYtdlpArgsValidation', () => {
  beforeEach(() => jest.clearAllMocks());

  test('initial state: not validating, no result', () => {
    const { result } = renderHook(() => useYtdlpArgsValidation('tok'));
    expect(result.current.validating).toBe(false);
    expect(result.current.result).toBeNull();
  });

  test('validate() posts to /api/ytdlp/validate-args with args + token header', async () => {
    axios.post.mockResolvedValueOnce({ data: { ok: true, message: 'Arguments parsed successfully' } });

    const { result } = renderHook(() => useYtdlpArgsValidation('tok-abc'));

    await act(async () => {
      await result.current.validate('--no-mtime');
    });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/ytdlp/validate-args',
      { args: '--no-mtime' },
      { headers: { 'x-access-token': 'tok-abc' } }
    );
    await waitFor(() => {
      expect(result.current.result).toEqual({ ok: true, message: 'Arguments parsed successfully' });
    });
  });

  test('validate() captures yt-dlp stderr on ok=false', async () => {
    axios.post.mockResolvedValueOnce({ data: { ok: false, stderr: 'yt-dlp: error: no such option' } });

    const { result } = renderHook(() => useYtdlpArgsValidation('tok'));

    await act(async () => {
      await result.current.validate('--bogus');
    });

    await waitFor(() => {
      expect(result.current.result).toEqual({ ok: false, stderr: 'yt-dlp: error: no such option' });
    });
  });

  test('validate() captures error message on 400 from server', async () => {
    axios.post.mockRejectedValueOnce({
      response: { status: 400, data: { error: '--exec is not allowed in custom args.' } },
    });

    const { result } = renderHook(() => useYtdlpArgsValidation('tok'));

    await act(async () => {
      await result.current.validate('--exec rm');
    });

    await waitFor(() => {
      expect(result.current.result).toEqual({
        ok: false,
        stderr: '--exec is not allowed in custom args.',
      });
    });
  });

  test('validate() returns generic message on network failure', async () => {
    axios.post.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useYtdlpArgsValidation('tok'));

    await act(async () => {
      await result.current.validate('--no-mtime');
    });

    await waitFor(() => {
      expect(result.current.result?.ok).toBe(false);
    });
    await waitFor(() => {
      expect(result.current.result?.stderr).toMatch(/validation failed/i);
    });
  });

  test('reset() clears the result', async () => {
    axios.post.mockResolvedValueOnce({ data: { ok: true, message: 'Arguments parsed successfully' } });

    const { result } = renderHook(() => useYtdlpArgsValidation('tok'));

    await act(async () => {
      await result.current.validate('--no-mtime');
    });
    await waitFor(() => expect(result.current.result).not.toBeNull());

    act(() => result.current.reset());
    expect(result.current.result).toBeNull();
  });
});
