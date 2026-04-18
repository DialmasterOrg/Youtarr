import { renderHook, act, waitFor } from '@testing-library/react';
import { useTriggerDownloads } from '../useTriggerDownloads';

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;

describe('useTriggerDownloads', () => {
  const token = 'test-token';
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockFetch.mockReset();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    consoleErrorSpy.mockRestore();
  });

  test('returns false and sets error when token is null', async () => {
    const { result } = renderHook(() => useTriggerDownloads(null));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.triggerDownloads({ urls: ['https://youtu.be/x'] });
    });

    expect(returned).toBe(false);
    expect(result.current.error?.message).toBe('No authentication token provided');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('POSTs urls and returns true on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useTriggerDownloads(token));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.triggerDownloads({ urls: ['https://youtu.be/x'] });
    });

    expect(returned).toBe(true);
    expect(result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith('/triggerspecificdownloads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token,
      },
      body: JSON.stringify({ urls: ['https://youtu.be/x'] }),
    });
  });

  test('includes overrideSettings in the request body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useTriggerDownloads(token));

    await act(async () => {
      await result.current.triggerDownloads({
        urls: ['https://youtu.be/x'],
        overrideSettings: {
          resolution: '1080',
          allowRedownload: true,
          subfolder: 'custom',
          audioFormat: 'mp3',
          rating: 'R',
          skipVideoFolder: true,
        },
      });
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.overrideSettings).toEqual({
      resolution: '1080',
      allowRedownload: true,
      subfolder: 'custom',
      audioFormat: 'mp3',
      rating: 'R',
      skipVideoFolder: true,
    });
  });

  test('includes channelId in the request body when provided', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useTriggerDownloads(token));

    await act(async () => {
      await result.current.triggerDownloads({
        urls: ['https://youtu.be/x'],
        channelId: 'UCabc',
      });
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.channelId).toBe('UCabc');
  });

  test('returns false and sets error when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, statusText: 'Bad Request' });
    const { result } = renderHook(() => useTriggerDownloads(token));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.triggerDownloads({ urls: ['https://youtu.be/x'] });
    });

    expect(returned).toBe(false);
    expect(result.current.error?.message).toBe('Failed to trigger downloads: Bad Request');
  });

  test('returns false and sets error when fetch rejects', async () => {
    const networkErr = new Error('Network down');
    mockFetch.mockRejectedValueOnce(networkErr);
    const { result } = renderHook(() => useTriggerDownloads(token));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.triggerDownloads({ urls: ['https://youtu.be/x'] });
    });

    expect(returned).toBe(false);
    expect(result.current.error).toBe(networkErr);
  });

  test('wraps non-Error rejections in an Error', async () => {
    mockFetch.mockRejectedValueOnce('string error');
    const { result } = renderHook(() => useTriggerDownloads(token));

    await act(async () => {
      await result.current.triggerDownloads({ urls: ['https://youtu.be/x'] });
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Unknown error');
  });

  test('toggles loading true during the call and false after', async () => {
    let resolveFetch!: (value: { ok: boolean }) => void;
    mockFetch.mockReturnValueOnce(
      new Promise<{ ok: boolean }>((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { result } = renderHook(() => useTriggerDownloads(token));

    let promise!: Promise<boolean>;
    act(() => {
      promise = result.current.triggerDownloads({ urls: ['https://youtu.be/x'] });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      resolveFetch({ ok: true });
      await promise;
    });

    expect(result.current.loading).toBe(false);
  });

  test('clears previous error on a new successful call', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, statusText: 'Boom' });
    const { result } = renderHook(() => useTriggerDownloads(token));

    await act(async () => {
      await result.current.triggerDownloads({ urls: ['https://youtu.be/x'] });
    });
    expect(result.current.error).not.toBeNull();

    mockFetch.mockResolvedValueOnce({ ok: true });
    await act(async () => {
      await result.current.triggerDownloads({ urls: ['https://youtu.be/x'] });
    });

    expect(result.current.error).toBeNull();
  });
});
