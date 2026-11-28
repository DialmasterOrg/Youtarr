import { renderHook, act, waitFor } from '@testing-library/react';
import { useTriggerDownloads, TriggerDownloadsResult } from '../useTriggerDownloads';

const FALLBACK = { ok: false, message: 'Failed to queue downloads. Please try again.' };

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

  test('ignores an overlapping submission without reporting failure', async () => {
    let resolve!: (value: { ok: boolean }) => void;
    mockFetch.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const { result } = renderHook(() => useTriggerDownloads(token));
    let first!: Promise<TriggerDownloadsResult | null>;
    act(() => { first = result.current.triggerDownloads({ urls: ['https://youtu.be/x'] }); });
    await act(async () => {
      expect(await result.current.triggerDownloads({ urls: ['https://youtu.be/y'] })).toBeNull();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    await act(async () => { resolve({ ok: true }); await first; });
  });

  test('sends an overlapping submission when overlap is allowed', async () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}));
    mockFetch.mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useTriggerDownloads(token, { allowOverlap: true }));
    act(() => { void result.current.triggerDownloads({ urls: ['https://youtu.be/x'] }); });

    let second: TriggerDownloadsResult | null | undefined;
    await act(async () => {
      second = await result.current.triggerDownloads({ urls: ['https://youtu.be/y'] });
    });

    expect(second).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('fails without a request and sets error when token is null', async () => {
    const { result } = renderHook(() => useTriggerDownloads(null));

    let returned: TriggerDownloadsResult | null | undefined;
    await act(async () => {
      returned = await result.current.triggerDownloads({ urls: ['https://youtu.be/x'] });
    });

    expect(returned).toEqual(FALLBACK);
    expect(result.current.error?.message).toBe('No authentication token provided');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('POSTs urls and reports success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useTriggerDownloads(token));

    let returned: TriggerDownloadsResult | null | undefined;
    await act(async () => {
      returned = await result.current.triggerDownloads({ urls: ['https://youtu.be/x'] });
    });

    expect(returned).toEqual({ ok: true });
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

  test('sends the protect choice with the override settings', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useTriggerDownloads(token));

    await act(async () => {
      await result.current.triggerDownloads({
        urls: ['https://youtu.be/x'],
        overrideSettings: { protect: true },
      });
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.overrideSettings).toEqual({ protect: true });
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

  test('includes videoChannelMap in the request body when non-empty', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useTriggerDownloads(token));

    await act(async () => {
      await result.current.triggerDownloads({
        urls: ['https://www.youtube.com/watch?v=abc123def45'],
        videoChannelMap: { abc123def45: 'UCabcdefghijklmnopqrstuv' },
      });
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.videoChannelMap).toEqual({ abc123def45: 'UCabcdefghijklmnopqrstuv' });
  });

  test('omits videoChannelMap from the request body when empty', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useTriggerDownloads(token));

    await act(async () => {
      await result.current.triggerDownloads({
        urls: ['https://www.youtube.com/watch?v=abc123def45'],
        videoChannelMap: {},
      });
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body).not.toHaveProperty('videoChannelMap');
  });

  test('fails with the reason the server gave', async () => {
    const reason = 'Downloads are paused: storage limit reached';
    mockFetch.mockResolvedValueOnce({ ok: false, json: jest.fn().mockResolvedValueOnce({ error: reason }) });
    const { result } = renderHook(() => useTriggerDownloads(token));

    let returned: TriggerDownloadsResult | null | undefined;
    await act(async () => {
      returned = await result.current.triggerDownloads({ urls: ['https://youtu.be/x'] });
    });

    expect(returned).toEqual({ ok: false, message: reason });
    expect(result.current.error?.message).toBe(reason);
  });

  test('fails with the fallback message when the server gave no reason', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: jest.fn().mockRejectedValueOnce(new Error('not json')) });
    const { result } = renderHook(() => useTriggerDownloads(token));

    let returned: TriggerDownloadsResult | null | undefined;
    await act(async () => {
      returned = await result.current.triggerDownloads({ urls: ['https://youtu.be/x'] });
    });

    expect(returned).toEqual(FALLBACK);
  });

  test('fails with the fallback message and sets error when fetch rejects', async () => {
    const networkErr = new Error('Network down');
    mockFetch.mockRejectedValueOnce(networkErr);
    const { result } = renderHook(() => useTriggerDownloads(token));

    let returned: TriggerDownloadsResult | null | undefined;
    await act(async () => {
      returned = await result.current.triggerDownloads({ urls: ['https://youtu.be/x'] });
    });

    expect(returned).toEqual(FALLBACK);
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

    let promise!: Promise<TriggerDownloadsResult | null>;
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
    mockFetch.mockResolvedValueOnce({ ok: false, json: jest.fn().mockResolvedValueOnce({ error: 'Boom' }) });
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
