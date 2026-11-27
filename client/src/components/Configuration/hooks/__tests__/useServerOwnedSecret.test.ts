import { act, renderHook, waitFor } from '@testing-library/react';
import { ServerOwnedSecretSource, useServerOwnedSecret } from '../useServerOwnedSecret';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const axios = require('axios');

const SOURCE: ServerOwnedSecretSource = {
  url: '/api/thing/secret',
  regenerateUrl: '/api/thing/secret/regenerate',
  field: 'secret',
  loadError: 'Could not load the secret.',
};
const SECRET = 'a'.repeat(64);
const NEW_SECRET = 'b'.repeat(64);

describe('useServerOwnedSecret', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: { secret: SECRET } });
    axios.post.mockResolvedValue({ data: { secret: NEW_SECRET } });
  });

  test('loads the secret with the auth token', async () => {
    const { result } = renderHook(() => useServerOwnedSecret(SOURCE, 'session', true));

    await waitFor(() => expect(result.current.value).toBe(SECRET));

    expect(axios.get).toHaveBeenCalledWith('/api/thing/secret', {
      headers: { 'x-access-token': 'session' },
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('does not ask for a secret while disabled, because the server would create one', () => {
    renderHook(() => useServerOwnedSecret(SOURCE, 'session', false));

    expect(axios.get).not.toHaveBeenCalled();
  });

  test('does not ask for a secret without a session', () => {
    renderHook(() => useServerOwnedSecret(SOURCE, null, true));

    expect(axios.get).not.toHaveBeenCalled();
  });

  test('loads the secret once it is enabled', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useServerOwnedSecret(SOURCE, 'session', enabled),
      { initialProps: { enabled: false } }
    );

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.value).toBe(SECRET));
  });

  test('reports a secret that cannot be loaded', async () => {
    axios.get.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useServerOwnedSecret(SOURCE, 'session', true));

    await waitFor(() => expect(result.current.error).toBe('Could not load the secret.'));
    expect(result.current.value).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  test('ignores a response that arrives after unmounting', async () => {
    let respond: (value: unknown) => void = () => {};
    axios.get.mockReturnValue(new Promise((resolve) => { respond = resolve; }));

    const { result, unmount } = renderHook(() => useServerOwnedSecret(SOURCE, 'session', true));
    unmount();
    await act(async () => respond({ data: { secret: SECRET } }));

    expect(result.current.value).toBeNull();
  });

  test('replaces the secret', async () => {
    const { result } = renderHook(() => useServerOwnedSecret(SOURCE, 'session', true));
    await waitFor(() => expect(result.current.value).toBe(SECRET));

    let succeeded = false;
    await act(async () => { succeeded = await result.current.regenerate(); });

    expect(axios.post).toHaveBeenCalledWith('/api/thing/secret/regenerate', null, {
      headers: { 'x-access-token': 'session' },
    });
    expect(succeeded).toBe(true);
    expect(result.current.value).toBe(NEW_SECRET);
    expect(result.current.regenerating).toBe(false);
  });

  test('keeps the current secret when it cannot be replaced', async () => {
    axios.post.mockRejectedValue(new Error('disk full'));
    const { result } = renderHook(() => useServerOwnedSecret(SOURCE, 'session', true));
    await waitFor(() => expect(result.current.value).toBe(SECRET));

    let succeeded = true;
    await act(async () => { succeeded = await result.current.regenerate(); });

    expect(succeeded).toBe(false);
    expect(result.current.value).toBe(SECRET);
    expect(result.current.regenerating).toBe(false);
  });
});
