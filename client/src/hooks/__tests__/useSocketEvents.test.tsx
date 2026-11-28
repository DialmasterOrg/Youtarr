import React from 'react';
import { renderHook } from '@testing-library/react';
import { useSocketEvents } from '../useSocketEvents';
import WebSocketContext from '../../contexts/WebSocketContext';

type Message = { type?: string; payload?: unknown };
type Filter = (message: Message) => boolean;
type Callback = (data: unknown) => void;

describe('useSocketEvents', () => {
  let subscriptions: Array<{ filter: Filter; callback: Callback }>;

  // Delivers a message the way WebSocketProvider does: payload only.
  const emit = (message: Message) => {
    subscriptions.forEach((sub) => {
      if (sub.filter(message)) sub.callback(message.payload);
    });
  };

  const socket = {
    socket: null,
    subscribe: (filter: Filter, callback: Callback) => {
      subscriptions.push({ filter, callback });
    },
    unsubscribe: (callback: Callback) => {
      subscriptions = subscriptions.filter((sub) => sub.callback !== callback);
    },
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <WebSocketContext.Provider value={socket}>{children}</WebSocketContext.Provider>
  );

  beforeEach(() => {
    subscriptions = [];
  });

  test('passes the payload and type of each listed message to onMessage', () => {
    const onMessage = jest.fn();
    const onRestored = jest.fn();
    renderHook(() => useSocketEvents(['jobsUpdated', 'videosUpdated'], onMessage, onRestored), { wrapper });

    emit({ type: 'videosUpdated', payload: { youtubeId: 'abc' } });
    emit({ type: 'jobsUpdated', payload: { jobId: 'j1' } });

    expect(onMessage.mock.calls).toEqual([
      [{ youtubeId: 'abc' }, 'videosUpdated'],
      [{ jobId: 'j1' }, 'jobsUpdated'],
    ]);
    expect(onRestored).not.toHaveBeenCalled();
  });

  test('ignores message types that are not listed', () => {
    const onMessage = jest.fn();
    const onRestored = jest.fn();
    renderHook(() => useSocketEvents(['jobsUpdated'], onMessage, onRestored), { wrapper });

    emit({ type: 'downloadProgress', payload: {} });
    emit({ payload: {} });

    expect(onMessage).not.toHaveBeenCalled();
    expect(onRestored).not.toHaveBeenCalled();
  });

  test('calls onRestored, not onMessage, when the connection comes back', () => {
    const onMessage = jest.fn();
    const onRestored = jest.fn();
    renderHook(() => useSocketEvents(['jobsUpdated'], onMessage, onRestored), { wrapper });

    emit({ type: 'connectionRestored', payload: {} });

    expect(onRestored).toHaveBeenCalledTimes(1);
    expect(onMessage).not.toHaveBeenCalled();
  });

  test('uses the latest handlers without subscribing again', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderHook(
      ({ handler }: { handler: () => void }) => useSocketEvents(['jobsUpdated'], handler, handler),
      { wrapper, initialProps: { handler: first } }
    );
    const subscribed = [...subscriptions];

    rerender({ handler: second });
    emit({ type: 'jobsUpdated' });
    emit({ type: 'connectionRestored' });

    expect(subscriptions).toEqual(subscribed);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(2);
  });

  test('stops listening on unmount', () => {
    const onMessage = jest.fn();
    const onRestored = jest.fn();
    const { unmount } = renderHook(
      () => useSocketEvents(['jobsUpdated'], onMessage, onRestored),
      { wrapper }
    );

    unmount();

    expect(subscriptions).toHaveLength(0);
  });

  test('does nothing without a WebSocket provider', () => {
    const { unmount } = renderHook(() => useSocketEvents(['jobsUpdated'], jest.fn(), jest.fn()));

    expect(() => unmount()).not.toThrow();
  });
});
