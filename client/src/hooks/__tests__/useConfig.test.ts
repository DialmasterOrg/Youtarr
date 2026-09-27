import { renderHook, waitFor } from '@testing-library/react';
import { useConfig } from '../useConfig';
import { LoggingStatus } from '../../components/Configuration/types';

const LOGGING: LoggingStatus = {
  envLevel: 'info',
  file: { enabled: true, directory: '/app/config/logs', maxSizeBytes: 10485760, maxFiles: 5, error: null },
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
