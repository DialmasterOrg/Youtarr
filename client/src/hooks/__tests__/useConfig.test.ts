import { act, renderHook, waitFor } from '@testing-library/react';
import { useConfig } from '../useConfig';
import { LoggingStatus, CustomArgsCheck } from '../../components/Configuration/types';

const LOGGING: LoggingStatus = {
  envLevel: 'info',
  file: { enabled: true, directory: '/app/config/logs', maxSizeBytes: 10485760, maxFiles: 5, error: null },
};

const CUSTOM_ARGS_CHECK: CustomArgsCheck = {
  blocked: [{ given: '--exec', option: '--exec', reason: 'can run programs or load code on the server' }],
  warnings: [],
  errors: [],
};

describe('useConfig logging status', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ preferredResolution: '720', logLevel: 'debug', logging: LOGGING }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('exposes the logging status from the server', async () => {
    const { result } = renderHook(() => useConfig('tok'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.loggingStatus).toEqual(LOGGING);
  });

  test('keeps the logging status out of the config that gets saved', async () => {
    const { result } = renderHook(() => useConfig('tok'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.config).not.toHaveProperty('logging');
    expect(result.current.config.logLevel).toBe('debug');
  });
});

describe('useConfig custom args check', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        preferredResolution: '720',
        customArgsCheck: CUSTOM_ARGS_CHECK,
      }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('exposes the custom args check from the server', async () => {
    const { result } = renderHook(() => useConfig('tok'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.customArgsCheck).toEqual(CUSTOM_ARGS_CHECK);
  });

  test('keeps the custom args check out of the config that gets saved', async () => {
    const { result } = renderHook(() => useConfig('tok'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.config).not.toHaveProperty('customArgsCheck');
  });

  test('setCustomArgsCheck replaces the check after a save', async () => {
    const { result } = renderHook(() => useConfig('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setCustomArgsCheck(null));

    expect(result.current.customArgsCheck).toBeNull();
  });
});
