import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import WebSocketContext from '../../../../../contexts/WebSocketContext';
import { useActiveReorganize } from '../useActiveReorganize';

jest.mock('axios', () => ({ get: jest.fn() }));

const axios = require('axios');

type Subscriber = { filter: (msg: unknown) => boolean; callback: (payload: unknown) => void };

function makeWrapper(subscribers: Subscriber[]) {
  const value = {
    socket: null,
    subscribe: (filter: (msg: unknown) => boolean, callback: (payload: unknown) => void) => {
      subscribers.push({ filter, callback });
    },
    unsubscribe: jest.fn(),
  };
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(WebSocketContext.Provider, { value }, children);
  };
}

describe('useActiveReorganize', () => {
  let subscribers: Subscriber[];
  const progress = (status: string) => ({
    type: 'tvReorganizeProgress', payload: { operationId: 3, status, total: 4, done: 1, failed: 0, label: 'Chan' },
  });
  const send = (message: { type: string; payload: unknown }) => subscribers
    .filter((s) => s.filter(message)).forEach((s) => s.callback(message.payload));

  beforeEach(() => {
    jest.clearAllMocks();
    subscribers = [];
    axios.get.mockResolvedValue({ data: { operation: null } });
  });

  test('loads the running reorganize', async () => {
    axios.get.mockResolvedValueOnce({ data: { operation: { id: 3, label: 'Chan', status: 'running' } } });

    const { result } = renderHook(() => useActiveReorganize('token'), { wrapper: makeWrapper(subscribers) });

    await waitFor(() => expect(result.current.operation).toMatchObject({ id: 3 }));
  });

  test('keeps the change of the running operation across progress messages', async () => {
    axios.get.mockResolvedValueOnce({ data: { operation: {
      id: 3, label: 'Kids', status: 'running', change: { type: 'folderLayout', folder: 'Kids', layout: 'tv' },
    } } });
    const { result } = renderHook(() => useActiveReorganize('token'), { wrapper: makeWrapper(subscribers) });
    await waitFor(() => expect(result.current.operation?.change).toBeDefined());

    act(() => send(progress('running')));

    expect(result.current.operation).toMatchObject({ id: 3, done: 1, change: { type: 'folderLayout', folder: 'Kids' } });
  });

  test('fetches the change once when progress names an operation it was not seeded with', async () => {
    const { result } = renderHook(() => useActiveReorganize('token'), { wrapper: makeWrapper(subscribers) });
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    axios.get.mockResolvedValueOnce({ data: { operation: {
      id: 3, label: 'Chan', status: 'running', done: 0, change: { type: 'folderLayout', folder: 'Kids', layout: 'tv' },
    } } });

    act(() => {
      send(progress('running'));
      send(progress('running'));
      send(progress('running'));
    });

    await waitFor(() => expect(result.current.operation?.change).toEqual({ type: 'folderLayout', folder: 'Kids', layout: 'tv' }));
    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(result.current.operation).toMatchObject({ id: 3, done: 1 });
  });

  test('a change that answers after the operation ended does not bring it back', async () => {
    const { result } = renderHook(() => useActiveReorganize('token'), { wrapper: makeWrapper(subscribers) });
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    let answer: (value: unknown) => void = () => undefined;
    axios.get.mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }));

    act(() => send(progress('running')));
    act(() => send(progress('completed')));
    await act(async () => {
      answer({ data: { operation: { id: 3, label: 'Chan', status: 'running', change: { type: 'folderLayout', folder: 'Kids', layout: 'tv' } } } });
    });

    expect(result.current.operation).toBeNull();
  });

  test('a retried operation fetches its change again', async () => {
    const { result } = renderHook(() => useActiveReorganize('token'), { wrapper: makeWrapper(subscribers) });
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    act(() => send(progress('running')));
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    act(() => send(progress('failed')));
    axios.get.mockResolvedValueOnce({ data: { operation: {
      id: 3, label: 'Chan', status: 'running', change: { type: 'defaultSubfolder', value: 'TV' },
    } } });

    act(() => send(progress('running')));

    await waitFor(() => expect(result.current.operation?.change).toEqual({ type: 'defaultSubfolder', value: 'TV' }));
    expect(axios.get).toHaveBeenCalledTimes(3);
  });

  test('follows progress broadcasts and clears when the reorganize ends', async () => {
    const { result } = renderHook(() => useActiveReorganize('token'), { wrapper: makeWrapper(subscribers) });
    await waitFor(() => expect(axios.get).toHaveBeenCalled());

    act(() => send(progress('running')));
    expect(result.current.operation).toMatchObject({ id: 3, label: 'Chan', done: 1, total: 4 });

    act(() => send(progress('completed')));
    expect(result.current.operation).toBeNull();
  });
});
