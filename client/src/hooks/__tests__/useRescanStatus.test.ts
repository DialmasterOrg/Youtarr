import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import axios from 'axios';
import { useRescanStatus, RescanLastRun, RescanProgress, RescanTrigger } from '../useRescanStatus';
import WebSocketContext from '../../contexts/WebSocketContext';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  isAxiosError: (err: unknown): boolean =>
    typeof err === 'object' && err !== null && 'response' in err
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

interface RescanStatusPayload {
  running: boolean;
  trigger?: RescanTrigger;
  lastRun?: RescanLastRun | null;
}

interface RescanStatusEnvelope {
  type: 'rescanStatus';
  payload: RescanStatusPayload;
}

type Subscriber = {
  filter: (msg: unknown) => boolean;
  callback: (msg: unknown) => void;
};

function makeWrapper(subscribers: Subscriber[]) {
  const value = {
    socket: null,
    subscribe: (filter: (msg: unknown) => boolean, callback: (msg: unknown) => void) => {
      subscribers.push({ filter, callback });
    },
    unsubscribe: (callback: (msg: unknown) => void) => {
      const idx = subscribers.findIndex((s) => s.callback === callback);
      if (idx >= 0) subscribers.splice(idx, 1);
    }
  };
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(WebSocketContext.Provider, { value }, children);
  }
  return Wrapper;
}

const finishedRun: RescanLastRun = {
  startedAt: '2026-05-04T15:00:00.000Z',
  completedAt: '2026-05-04T15:01:00.000Z',
  trigger: 'scheduled',
  status: 'completed',
  videosUpdated: 0,
  videosMarkedMissing: 0,
  videosScanned: 10,
  filesFoundOnDisk: 10,
  errorMessage: null
};

// Renders the hook with a status request left pending (the first one, or the
// reload after `loaded` answered the first). `respond` answers it; `deliver`
// sends a socket message the way WebSocketProvider does.
function renderWithPendingStatus(loaded?: unknown) {
  let resolve: (value: { data: unknown }) => void = () => {};
  if (loaded) mockedAxios.get.mockResolvedValueOnce({ data: loaded });
  mockedAxios.get.mockReturnValueOnce(new Promise((resolver) => { resolve = resolver; }));
  const subscribers: Subscriber[] = [];
  const view = renderHook(() => useRescanStatus('tok'), { wrapper: makeWrapper(subscribers) });
  return {
    ...view,
    deliver: (type: string, payload: unknown = {}) => act(() => {
      subscribers.forEach((s) => s.filter({ type, payload }) && s.callback(payload));
    }),
    respond: (data: unknown) => act(async () => { resolve({ data }); }),
  };
}

describe('useRescanStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetches initial status on mount', async () => {
    const lastRun: RescanLastRun = {
      startedAt: '2026-05-04T15:00:00.000Z',
      completedAt: '2026-05-04T15:01:00.000Z',
      trigger: 'manual',
      status: 'completed',
      videosUpdated: 3,
      videosMarkedMissing: 1,
      videosScanned: 100,
      filesFoundOnDisk: 99,
      errorMessage: null
    };
    mockedAxios.get.mockResolvedValueOnce({ data: { running: false, lastRun } });

    const subscribers: Subscriber[] = [];
    const { result } = renderHook(() => useRescanStatus('tok'), {
      wrapper: makeWrapper(subscribers)
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.running).toBe(false);
    expect(result.current.lastRun).toEqual(lastRun);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      '/api/maintenance/rescan-status',
      expect.objectContaining({ headers: { 'x-access-token': 'tok' } })
    );
  });

  test('updates state from WebSocket rescanStatus messages', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { running: false, lastRun: null } });

    const subscribers: Subscriber[] = [];
    const { result } = renderHook(() => useRescanStatus('tok'), {
      wrapper: makeWrapper(subscribers)
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    // WebSocketProvider passes the full message to filter() but only the
    // payload to callback(); mirror that contract here.
    act(() => {
      const startMsg: RescanStatusEnvelope = {
        type: 'rescanStatus',
        payload: { running: true, trigger: 'manual' }
      };
      subscribers.forEach((s) => s.filter(startMsg) && s.callback(startMsg.payload));
    });
    expect(result.current.running).toBe(true);

    const lastRun: RescanLastRun = {
      startedAt: '2026-05-04T15:00:00.000Z',
      completedAt: '2026-05-04T15:01:00.000Z',
      trigger: 'manual',
      status: 'completed',
      videosUpdated: 0,
      videosMarkedMissing: 0,
      videosScanned: 0,
      filesFoundOnDisk: 0,
      errorMessage: null
    };
    act(() => {
      const endMsg: RescanStatusEnvelope = {
        type: 'rescanStatus',
        payload: { running: false, lastRun }
      };
      subscribers.forEach((s) => s.filter(endMsg) && s.callback(endMsg.payload));
    });
    expect(result.current.running).toBe(false);
    expect(result.current.lastRun).toEqual(lastRun);
  });

  test('tracks the progress a running rescan reports, and drops it when the rescan ends', async () => {
    const progress: RescanProgress = {
      phase: 'walk', foldersScanned: 4210, filesFound: 3980, videosProcessed: 0, videosTotal: 0, startedAt: '2026-11-21T14:34:00.000Z',
    };
    mockedAxios.get.mockResolvedValueOnce({ data: { running: true, progress, lastRun: null } });

    const subscribers: Subscriber[] = [];
    const { result } = renderHook(() => useRescanStatus('tok'), {
      wrapper: makeWrapper(subscribers)
    });

    await waitFor(() => expect(result.current.progress).toEqual(progress));

    const later: RescanProgress = { ...progress, phase: 'rows', videosProcessed: 5000, videosTotal: 16801 };
    act(() => {
      const msg = { type: 'rescanStatus', payload: { running: true, trigger: 'startup', progress: later } };
      subscribers.forEach((s) => s.filter(msg) && s.callback(msg.payload));
    });
    expect(result.current.progress).toEqual(later);

    act(() => {
      const msg = { type: 'rescanStatus', payload: { running: false, lastRun: null } };
      subscribers.forEach((s) => s.filter(msg) && s.callback(msg.payload));
    });
    expect(result.current.progress).toBeNull();
  });

  test('triggerRescan POSTs and clears prior error', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { running: false, lastRun: null } });
    mockedAxios.post.mockResolvedValueOnce({ status: 202, data: { status: 'started' } });

    const { result } = renderHook(() => useRescanStatus('tok'), {
      wrapper: makeWrapper([])
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome: { started: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.triggerRescan();
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      '/api/maintenance/rescan-files',
      undefined,
      expect.objectContaining({ headers: { 'x-access-token': 'tok' } })
    );
    expect(outcome).toEqual({ started: true });
    expect(result.current.error).toBeNull();
    expect(result.current.running).toBe(true);
  });

  test('triggerRescan can ask to skip the downloads folder check', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { running: false, lastRun: null } });
    mockedAxios.post.mockResolvedValueOnce({ status: 202, data: { status: 'started' } });

    const { result } = renderHook(() => useRescanStatus('tok'), {
      wrapper: makeWrapper([])
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.triggerRescan({ ignoreLibraryCheck: true });
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      '/api/maintenance/rescan-files',
      { ignoreLibraryCheck: true },
      expect.objectContaining({ headers: { 'x-access-token': 'tok' } })
    );
    expect(result.current.running).toBe(true);
  });

  test('triggerRescan surfaces 409 as a user-friendly error', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { running: false, lastRun: null } });
    const err = new Error('Conflict') as Error & {
      response: { status: number; data: { error: string } };
    };
    err.response = { status: 409, data: { error: 'Rescan already in progress' } };
    mockedAxios.post.mockRejectedValueOnce(err);

    const { result } = renderHook(() => useRescanStatus('tok'), {
      wrapper: makeWrapper([])
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome: { started: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.triggerRescan();
    });

    expect(outcome).toEqual({ started: false });
    expect(result.current.error).toBe('Rescan already in progress');
    expect(result.current.running).toBe(true);
  });

  test('triggerRescan reverts optimistic running state when start fails', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { running: false, lastRun: null } });
    mockedAxios.post.mockRejectedValueOnce(new Error('Network Error'));

    const { result } = renderHook(() => useRescanStatus('tok'), {
      wrapper: makeWrapper([])
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome: { started: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.triggerRescan();
    });

    expect(outcome).toEqual({ started: false });
    expect(result.current.running).toBe(false);
    expect(result.current.error).toBe('Network Error');
  });

  test('clears transient errors when WebSocket status advances', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { running: false, lastRun: null } });
    const err = new Error('Conflict') as Error & {
      response: { status: number; data: { error: string } };
    };
    err.response = { status: 409, data: { error: 'Rescan already in progress' } };
    mockedAxios.post.mockRejectedValueOnce(err);

    const subscribers: Subscriber[] = [];
    const { result } = renderHook(() => useRescanStatus('tok'), {
      wrapper: makeWrapper(subscribers)
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.triggerRescan();
    });
    expect(result.current.error).toBe('Rescan already in progress');

    act(() => {
      const startMsg: RescanStatusEnvelope = {
        type: 'rescanStatus',
        payload: { running: true, trigger: 'scheduled' }
      };
      subscribers.forEach((s) => s.filter(startMsg) && s.callback(startMsg.payload));
    });

    expect(result.current.error).toBeNull();
  });

  test('loads the status again when the connection is restored', async () => {
    const { result, deliver, respond } = renderWithPendingStatus({ running: true, lastRun: null });
    await waitFor(() => expect(result.current.running).toBe(true));

    // The rescan ended while disconnected, so no message reported it.
    deliver('connectionRestored');
    await respond({ running: false, lastRun: finishedRun });

    expect(result.current.running).toBe(false);
    expect(result.current.lastRun).toEqual(finishedRun);
  });

  test('keeps a live message that arrived while the status was loading', async () => {
    const { result, deliver, respond } = renderWithPendingStatus();

    deliver('rescanStatus', { running: false, lastRun: finishedRun });
    // The response was read before the rescan ended.
    await respond({ running: true, lastRun: null });

    expect(result.current.running).toBe(false);
    expect(result.current.lastRun).toEqual(finishedRun);
  });

  test('takes the last run from a response that live progress overtook', async () => {
    const older: RescanProgress = {
      phase: 'walk', foldersScanned: 10, filesFound: 9, videosProcessed: 0, videosTotal: 0, startedAt: '2026-11-21T14:34:00.000Z',
    };
    const live: RescanProgress = { ...older, phase: 'rows', videosProcessed: 50, videosTotal: 100 };
    const { result, deliver, respond } = renderWithPendingStatus();

    deliver('rescanStatus', { running: true, progress: live });
    await respond({ running: true, progress: older, lastRun: finishedRun });

    expect(result.current.progress).toEqual(live);
    expect(result.current.lastRun).toEqual(finishedRun);
  });

  test('a reload in flight does not turn off a rescan that was just started', async () => {
    mockedAxios.post.mockResolvedValueOnce({ status: 202, data: { status: 'started' } });
    const { result, deliver, respond } = renderWithPendingStatus({ running: false, lastRun: null });
    await waitFor(() => expect(result.current.loading).toBe(false));

    deliver('connectionRestored');
    await act(async () => {
      await result.current.triggerRescan();
    });
    await respond({ running: false, lastRun: finishedRun });

    expect(result.current.running).toBe(true);
    expect(result.current.lastRun).toEqual(finishedRun);
  });

  test('a reload does not clear the error of a rescan that failed to start', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('Network Error'));
    const { result, deliver, respond } = renderWithPendingStatus({ running: false, lastRun: null });
    await waitFor(() => expect(result.current.loading).toBe(false));

    deliver('connectionRestored');
    await act(async () => {
      await result.current.triggerRescan();
    });
    await respond({ running: false, lastRun: null });

    expect(result.current.error).toBe('Network Error');
  });
});
