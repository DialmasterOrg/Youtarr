import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import axios from 'axios';
import { useRescanStatus, RescanLastRun, RescanTrigger } from '../useRescanStatus';
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

  test('triggerRescan POSTs and clears prior error', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { running: false, lastRun: null } });
    mockedAxios.post.mockResolvedValueOnce({ status: 202, data: { status: 'started' } });

    const { result } = renderHook(() => useRescanStatus('tok'), {
      wrapper: makeWrapper([])
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.triggerRescan();
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      '/api/maintenance/rescan-files',
      undefined,
      expect.objectContaining({ headers: { 'x-access-token': 'tok' } })
    );
    expect(result.current.error).toBeNull();
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

    await act(async () => {
      await result.current.triggerRescan();
    });

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

    await act(async () => {
      await result.current.triggerRescan();
    });

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
});
