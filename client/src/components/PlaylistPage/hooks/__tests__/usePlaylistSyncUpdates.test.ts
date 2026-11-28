import React from 'react';
import { renderHook } from '@testing-library/react';
import WebSocketContext from '../../../../contexts/WebSocketContext';
import { usePlaylistSyncUpdates } from '../usePlaylistSyncUpdates';

type Message = { type: string; destination?: string; payload?: unknown };
type Filter = (message: Message) => boolean;
type Callback = (payload: unknown) => void;

function setup(playlistDbId: number | null, onUpdate = jest.fn()) {
  const subscriptions: Array<{ filter: Filter; callback: Callback }> = [];
  const subscribe = jest.fn((filter: Filter, callback: Callback) => {
    subscriptions.push({ filter, callback });
  });
  const unsubscribe = jest.fn((callback: Callback) => {
    const index = subscriptions.findIndex((entry) => entry.callback === callback);
    if (index >= 0) subscriptions.splice(index, 1);
  });
  // Delivers a message the way the provider does: its payload, to every subscription whose filter accepts it.
  const deliver = (message: Message) => {
    subscriptions
      .filter((entry) => entry.filter(message))
      .forEach((entry) => entry.callback(message.payload));
  };
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      WebSocketContext.Provider,
      { value: { socket: null, subscribe, unsubscribe } },
      children
    );
  const view = renderHook(
    ({ id }: { id: number | null }) => usePlaylistSyncUpdates(id, onUpdate),
    { wrapper, initialProps: { id: playlistDbId } }
  );
  return { ...view, deliver, onUpdate };
}

const syncUpdated = (playlistDbId: number) => ({
  destination: 'broadcast',
  type: 'playlistSyncUpdated',
  payload: { playlistDbId },
});

describe('usePlaylistSyncUpdates', () => {
  test('calls onUpdate when a sync of the open playlist starts or ends', () => {
    const { deliver, onUpdate } = setup(7);

    deliver(syncUpdated(7));

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  test('ignores sync updates for other playlists', () => {
    const { deliver, onUpdate } = setup(7);

    deliver(syncUpdated(8));

    expect(onUpdate).not.toHaveBeenCalled();
  });

  test('ignores other broadcasts', () => {
    const { deliver, onUpdate } = setup(7);

    deliver({ destination: 'broadcast', type: 'videosUpdated', payload: { playlistDbId: 7 } });

    expect(onUpdate).not.toHaveBeenCalled();
  });

  test('calls onUpdate after a reconnect, since a sync may have ended while disconnected', () => {
    const { deliver, onUpdate } = setup(7);

    deliver({ type: 'connectionRestored' });

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  test('calls nothing until the playlist is known', () => {
    const { deliver, onUpdate } = setup(null);

    deliver({ type: 'connectionRestored' });
    deliver({ type: 'playlistSyncUpdated', payload: {} });

    expect(onUpdate).not.toHaveBeenCalled();
  });

  test('follows the playlist when it changes', () => {
    const { deliver, onUpdate, rerender } = setup(7);

    rerender({ id: 9 });
    deliver(syncUpdated(7));
    expect(onUpdate).not.toHaveBeenCalled();

    deliver(syncUpdated(9));
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});
