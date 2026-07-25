import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCurrentActivitySeed } from '../useCurrentActivitySeed';
import WebSocketContext from '../../../../contexts/WebSocketContext';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

const axios = require('axios');

type Filter = (message: { destination?: string; type?: string }) => boolean;
type Callback = (data: unknown) => void;

describe('useCurrentActivitySeed', () => {
  const mockToken = 'test-token-123';

  let subscriptions: Array<{ filter: Filter; callback: Callback }>;
  let subscribe: jest.Mock;
  let unsubscribe: jest.Mock;
  let applyPayload: jest.Mock;
  let resetActivityState: jest.Mock;
  let liveMessageGenerationRef: { current: number };

  const emitMessage = (message: {
    destination?: string;
    type?: string;
    payload?: unknown;
  }) => {
    act(() => {
      subscriptions.forEach((sub) => {
        if (sub.filter(message)) {
          sub.callback(message.payload);
        }
      });
    });
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <WebSocketContext.Provider value={{ socket: null, subscribe, unsubscribe }}>
      {children}
    </WebSocketContext.Provider>
  );

  const renderSeedHook = (token: string | null = mockToken) =>
    renderHook(
      () =>
        useCurrentActivitySeed({
          token,
          liveMessageGenerationRef,
          applyPayload,
          resetActivityState,
        }),
      { wrapper }
    );

  const freshSnapshot = {
    jobId: 'job-1',
    capturedAt: Date.now(),
    terminal: false,
    activity: { state: 'downloading_video', downloadType: 'Channel Downloads' },
    lastFinalActivity: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    subscriptions = [];
    subscribe = jest.fn((filter: Filter, callback: Callback) => {
      subscriptions.push({ filter, callback });
    });
    unsubscribe = jest.fn((callback: Callback) => {
      subscriptions = subscriptions.filter((sub) => sub.callback !== callback);
    });
    applyPayload = jest.fn();
    resetActivityState = jest.fn();
    liveMessageGenerationRef = { current: 0 };
  });

  test('does not probe when token is null', () => {
    renderSeedHook(null);
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('seeds fresh non-terminal activity as a progress payload on mount', async () => {
    axios.get.mockResolvedValueOnce({ data: freshSnapshot });

    renderSeedHook();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/jobs/current-activity', {
        headers: { 'x-access-token': mockToken },
      });
    });
    await waitFor(() => {
      expect(applyPayload).toHaveBeenCalledWith({
        progress: freshSnapshot.activity,
      });
    });
    // Any applied probe result replaces screen state wholesale, so state
    // left by a previous job (missed initiating) cannot linger
    expect(resetActivityState).toHaveBeenCalledTimes(1);
    expect(resetActivityState.mock.invocationCallOrder[0]).toBeLessThan(
      applyPayload.mock.invocationCallOrder[0]
    );
  });

  test('seeds even when live messages arrived before the probe started', async () => {
    // A REST snapshot taken after those messages is at least as fresh as they
    // were; only mid-flight messages may veto it
    liveMessageGenerationRef.current = 5;
    axios.get.mockResolvedValueOnce({ data: freshSnapshot });

    renderSeedHook();

    await waitFor(() => {
      expect(applyPayload).toHaveBeenCalledWith({
        progress: freshSnapshot.activity,
      });
    });
  });

  test('ignores a probe that resolves after a live message arrived mid-flight', async () => {
    let resolveProbe: (value: unknown) => void = () => {};
    axios.get.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveProbe = resolve;
      })
    );

    renderSeedHook();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    // A live broadcast lands while the REST request is still in flight
    liveMessageGenerationRef.current += 1;

    await act(async () => {
      resolveProbe({ data: freshSnapshot });
    });

    expect(applyPayload).not.toHaveBeenCalled();
    expect(resetActivityState).not.toHaveBeenCalled();
  });

  test('resets activity state and seeds the last final activity when the snapshot is terminal', async () => {
    const finalPayload = {
      text: 'done',
      finalSummary: { totalDownloaded: 3, totalSkipped: 0, jobType: 'Channel Downloads' },
    };
    axios.get.mockResolvedValueOnce({
      data: {
        jobId: 'job-1',
        capturedAt: Date.now(),
        terminal: true,
        activity: { state: 'complete' },
        lastFinalActivity: finalPayload,
      },
    });

    renderSeedHook();

    await waitFor(() => {
      expect(applyPayload).toHaveBeenCalledWith(finalPayload);
    });
    expect(resetActivityState).toHaveBeenCalledTimes(1);
    expect(resetActivityState.mock.invocationCallOrder[0]).toBeLessThan(
      applyPayload.mock.invocationCallOrder[0]
    );
  });

  test('resets activity state without seeding for stale non-terminal activity', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        ...freshSnapshot,
        capturedAt: Date.now() - 10 * 60 * 1000,
        lastFinalActivity: null,
      },
    });

    renderSeedHook();

    await waitFor(() => {
      expect(resetActivityState).toHaveBeenCalledTimes(1);
    });
    expect(applyPayload).not.toHaveBeenCalled();
  });

  test('discards an older probe result when a newer probe has started', async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    axios.get.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        })
    );

    renderSeedHook();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    // Second probe starts before the first resolves
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    const newerSnapshot = {
      ...freshSnapshot,
      activity: { state: 'downloading_video', downloadType: 'Playlist: Newer' },
    };

    // Newer probe resolves first, then the stale one
    await act(async () => {
      resolvers[1]({ data: newerSnapshot });
    });
    await act(async () => {
      resolvers[0]({ data: freshSnapshot });
    });

    expect(applyPayload).toHaveBeenCalledTimes(1);
    expect(applyPayload).toHaveBeenCalledWith({
      progress: newerSnapshot.activity,
    });
  });

  test('re-probes on connectionRestored and applies despite earlier live messages', async () => {
    axios.get.mockResolvedValue({ data: freshSnapshot });

    renderSeedHook();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
    applyPayload.mockClear();

    // Messages received before the reconnect must not veto the fresh probe
    liveMessageGenerationRef.current = 3;
    emitMessage({ destination: 'local', type: 'connectionRestored', payload: {} });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(applyPayload).toHaveBeenCalledWith({
        progress: freshSnapshot.activity,
      });
    });
  });

  test('re-probes when the tab becomes visible', async () => {
    axios.get.mockResolvedValue({ data: freshSnapshot });

    renderSeedHook();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });

  test('cleans up listeners on unmount', async () => {
    axios.get.mockResolvedValue({ data: freshSnapshot });

    const { unmount } = renderSeedHook();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    unmount();

    expect(unsubscribe).toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test('ignores probe failures', async () => {
    axios.get.mockRejectedValueOnce(new Error('network down'));

    renderSeedHook();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalled();
    });
    expect(applyPayload).not.toHaveBeenCalled();
    expect(resetActivityState).not.toHaveBeenCalled();
  });
});
