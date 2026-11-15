import { act, renderHook, waitFor } from '@testing-library/react';
import { useArrBridgeConnections } from '../useArrBridgeConnections';
import { ArrConnectionResult } from '../../utils/arrBridgeSetup';

jest.mock('axios', () => ({
  get: jest.fn(),
  put: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
  isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError),
}));

const axios = require('axios');

const HEADERS = { headers: { 'x-access-token': 'session' } };
const STATUS = {
  enabled: true,
  stagingRoot: '/data/.arr-staging',
  stagingClientPath: '/data/.arr-staging',
  connections: {
    sonarr: { url: null, keySet: false },
    radarr: { url: 'http://radarr:7878', keySet: true },
  },
};
const SAVED = { url: 'http://sonarr:8989', keySet: true };

const httpError = (status: number, data: unknown) => ({ isAxiosError: true, response: { status, data } });

async function loaded() {
  const view = renderHook(() => useArrBridgeConnections('session'));
  await waitFor(() => expect(view.result.current.status).not.toBeNull());
  return view;
}

describe('useArrBridgeConnections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: STATUS });
  });

  test('loads the status with the session token', async () => {
    const { result } = await loaded();

    expect(axios.get).toHaveBeenCalledWith('/api/arr-bridge/status', HEADERS);
    expect(result.current.status).toEqual(STATUS);
    expect(result.current.loading).toBe(false);
  });

  test('does not load without a session', () => {
    renderHook(() => useArrBridgeConnections(null));

    expect(axios.get).not.toHaveBeenCalled();
  });

  test('reports a status that cannot be loaded', async () => {
    axios.get.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useArrBridgeConnections('session'));

    await waitFor(() => expect(result.current.error).toBe('Could not load the Sonarr and Radarr connections.'));
    expect(result.current.status).toBeNull();
  });

  test('a saved connection replaces the one in the status', async () => {
    axios.put.mockResolvedValue({ data: { ok: true, appName: 'Sonarr', version: '4.0.20', connection: SAVED } });
    const { result } = await loaded();

    let outcome: ArrConnectionResult = { ok: false };
    await act(async () => {
      outcome = await result.current.save('sonarr', 'http://sonarr:8989', 'the-key');
    });

    expect(axios.put).toHaveBeenCalledWith(
      '/api/arr-bridge/connections/sonarr', { url: 'http://sonarr:8989', apiKey: 'the-key' }, HEADERS
    );
    expect(outcome).toMatchObject({ ok: true, version: '4.0.20' });
    expect(result.current.status?.connections.sonarr).toEqual(SAVED);
    expect(result.current.status?.connections.radarr).toEqual(STATUS.connections.radarr);
    expect(result.current.busyApp).toBeNull();
  });

  test('a refused connection leaves the status as it was', async () => {
    const refused = { ok: false, reason: 'unauthorized', message: 'Sonarr rejected the API key.' };
    axios.put.mockResolvedValue({ data: refused });
    const { result } = await loaded();

    let outcome: ArrConnectionResult = { ok: true };
    await act(async () => {
      outcome = await result.current.save('sonarr', 'http://sonarr:8989', 'wrong');
    });

    expect(outcome).toEqual(refused);
    expect(result.current.status?.connections.sonarr).toEqual(STATUS.connections.sonarr);
  });

  test('passes on what the server says is wrong with the input', async () => {
    axios.put.mockRejectedValue(httpError(400, { error: 'Enter the API key' }));
    const { result } = await loaded();

    let outcome: ArrConnectionResult = { ok: true };
    await act(async () => {
      outcome = await result.current.save('sonarr', 'http://sonarr:8989', '');
    });

    expect(outcome).toEqual({ ok: false, message: 'Enter the API key' });
  });

  test('says to wait when there were too many attempts', async () => {
    axios.put.mockRejectedValue(httpError(429, { error: 'Too many connection tests.' }));
    const { result } = await loaded();

    let outcome: ArrConnectionResult = { ok: true };
    await act(async () => {
      outcome = await result.current.save('sonarr', 'http://sonarr:8989', 'the-key');
    });

    expect(outcome).toEqual({ ok: false, message: 'Too many attempts. Wait a minute and try again.' });
  });

  test('a save that never reached the server has its own message', async () => {
    axios.put.mockRejectedValue(new Error('Network Error'));
    const { result } = await loaded();

    let outcome: ArrConnectionResult = { ok: true };
    await act(async () => {
      outcome = await result.current.save('sonarr', 'http://sonarr:8989', 'the-key');
    });

    expect(outcome).toEqual({ ok: false, message: 'Could not save the connection.' });
  });

  test('tests the saved connection without sending anything', async () => {
    axios.post.mockResolvedValue({ data: { ok: true, appName: 'Radarr', version: '6.4.4' } });
    const { result } = await loaded();

    let outcome: ArrConnectionResult = { ok: false };
    await act(async () => {
      outcome = await result.current.test('radarr');
    });

    expect(axios.post).toHaveBeenCalledWith('/api/arr-bridge/connections/radarr/test', null, HEADERS);
    expect(outcome).toEqual({ ok: true, appName: 'Radarr', version: '6.4.4' });
  });

  test('a test that fails to run says so', async () => {
    axios.post.mockRejectedValue(httpError(500, { error: 'Could not test the connection' }));
    const { result } = await loaded();

    let outcome: ArrConnectionResult = { ok: true };
    await act(async () => {
      outcome = await result.current.test('radarr');
    });

    expect(outcome).toEqual({ ok: false, message: 'Could not test the connection.' });
  });

  test('removing a connection clears it in the status', async () => {
    axios.delete.mockResolvedValue({ data: { connection: { url: null, keySet: false } } });
    const { result } = await loaded();

    let succeeded = false;
    await act(async () => {
      succeeded = await result.current.remove('radarr');
    });

    expect(axios.delete).toHaveBeenCalledWith('/api/arr-bridge/connections/radarr', HEADERS);
    expect(succeeded).toBe(true);
    expect(result.current.status?.connections.radarr).toEqual({ url: null, keySet: false });
  });

  test('a failed removal keeps the connection', async () => {
    axios.delete.mockRejectedValue(new Error('offline'));
    const { result } = await loaded();

    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.remove('radarr');
    });

    expect(succeeded).toBe(false);
    expect(result.current.status?.connections.radarr).toEqual(STATUS.connections.radarr);
  });
});
