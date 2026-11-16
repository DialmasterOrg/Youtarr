import { act, renderHook, waitFor } from '@testing-library/react';
import { useArrBridgeFolderCheck } from '../useArrBridgeFolderCheck';

jest.mock('axios', () => ({
  get: jest.fn(),
  isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean } | null)?.isAxiosError),
}));

const axios = require('axios');

const SEEN = { ok: true, visible: true, path: '/usr/src/app/data/.arr-staging' };
const NOT_SEEN = { ok: true, visible: false, path: '/usr/src/app/data/.arr-staging' };
const BOTH = { sonarr: true, radarr: true };
const HEADERS = { headers: { 'x-access-token': 'session' } };

const answerBy = (answers: Record<string, unknown>) => (url: string) => {
  const app = url.includes('/sonarr/') ? 'sonarr' : 'radarr';
  const answer = answers[app];
  return answer instanceof Error ? Promise.reject(answer) : Promise.resolve({ data: answer });
};

describe('useArrBridgeFolderCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockImplementation(answerBy({ sonarr: SEEN, radarr: NOT_SEEN }));
  });

  test('asks each connected app whether it sees the folder', async () => {
    const { result } = renderHook(() => useArrBridgeFolderCheck('session', BOTH, 'v1'));

    await waitFor(() => expect(result.current.checking).toBe(false));

    expect(axios.get).toHaveBeenCalledWith('/api/arr-bridge/connections/sonarr/shared-folder', HEADERS);
    expect(axios.get).toHaveBeenCalledWith('/api/arr-bridge/connections/radarr/shared-folder', HEADERS);
    expect(result.current.results).toEqual({ sonarr: SEEN, radarr: NOT_SEEN });
  });

  test('an app that is not connected is not asked', async () => {
    const { result } = renderHook(() => useArrBridgeFolderCheck('session', { sonarr: true, radarr: false }, 'v1'));

    await waitFor(() => expect(result.current.results).toEqual({ sonarr: SEEN }));
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test('asks nothing without a session or without a connection', () => {
    renderHook(() => useArrBridgeFolderCheck(null, BOTH, 'v1'));
    const { result } = renderHook(() => useArrBridgeFolderCheck('session', { sonarr: false, radarr: false }, 'v1'));

    expect(axios.get).not.toHaveBeenCalled();
    expect(result.current.results).toEqual({});
    expect(result.current.checking).toBe(false);
  });

  test('checks again when asked to', async () => {
    const { result } = renderHook(() => useArrBridgeFolderCheck('session', { sonarr: true, radarr: false }, 'v1'));
    await waitFor(() => expect(result.current.results.sonarr).toEqual(SEEN));
    axios.get.mockImplementation(answerBy({ sonarr: NOT_SEEN }));

    act(() => result.current.recheck());

    await waitFor(() => expect(result.current.results.sonarr).toEqual(NOT_SEEN));
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test('checks again when what was saved changes', async () => {
    const { result, rerender } = renderHook(
      ({ version }: { version: string }) => useArrBridgeFolderCheck('session', { sonarr: true, radarr: false }, version),
      { initialProps: { version: '|http://sonarr:8989' } }
    );
    await waitFor(() => expect(result.current.results.sonarr).toEqual(SEEN));

    rerender({ version: '/downloads/staging|http://sonarr:8989' });

    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
  });

  test('one app that cannot be asked does not hide the other\'s answer', async () => {
    axios.get.mockImplementation(answerBy({ sonarr: new Error('offline'), radarr: SEEN }));

    const { result } = renderHook(() => useArrBridgeFolderCheck('session', BOTH, 'v1'));

    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.results.radarr).toEqual(SEEN);
    expect(result.current.results.sonarr).toEqual({ ok: false, message: 'Could not run the check.' });
  });

  test('says when there were too many attempts', async () => {
    const limited = Object.assign(new Error('429'), { isAxiosError: true, response: { status: 429 } });
    axios.get.mockImplementation(answerBy({ sonarr: limited }));

    const { result } = renderHook(() => useArrBridgeFolderCheck('session', { sonarr: true, radarr: false }, 'v1'));

    await waitFor(() => expect(result.current.results.sonarr).toEqual({
      ok: false,
      message: 'Too many attempts. Wait a minute and check again.',
    }));
  });

  test('ignores an answer that arrives after unmounting', async () => {
    let respond: (value: unknown) => void = () => {};
    axios.get.mockReturnValue(new Promise((resolve) => { respond = resolve; }));
    const { result, unmount } = renderHook(() => useArrBridgeFolderCheck('session', { sonarr: true, radarr: false }, 'v1'));

    unmount();
    await act(async () => {
      respond({ data: SEEN });
    });

    expect(result.current.results).toEqual({});
  });
});
