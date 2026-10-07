import { renderHook, waitFor, act } from '@testing-library/react';
import { useConfig, CONFIG_PATCHED_EVENT } from '../useConfig';
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

describe('useConfig patched from elsewhere', () => {
  const originalFetch = global.fetch;
  const MAPPINGS = [{ subfolder: 'TV', libraryId: '41' }];

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ preferredResolution: '720', plexSubfolderLibraryMappings: [] }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('takes a saved field into the config and its saved copy, keeping unsaved edits', async () => {
    const { result } = renderHook(() => useConfig('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setConfig((prev) => ({ ...prev, preferredResolution: '1080' })); });

    act(() => {
      window.dispatchEvent(new CustomEvent(CONFIG_PATCHED_EVENT, { detail: { plexSubfolderLibraryMappings: MAPPINGS } }));
    });

    expect(result.current.config.plexSubfolderLibraryMappings).toEqual(MAPPINGS);
    expect(result.current.config.preferredResolution).toBe('1080');
    expect(result.current.initialConfig?.plexSubfolderLibraryMappings).toEqual(MAPPINGS);
    expect(result.current.initialConfig?.preferredResolution).toBe('720');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('takes a default folder change into both copies', async () => {
    const { result } = renderHook(() => useConfig('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      window.dispatchEvent(new CustomEvent(CONFIG_PATCHED_EVENT, { detail: { defaultSubfolder: 'TV' } }));
    });

    expect(result.current.config.defaultSubfolder).toBe('TV');
    expect(result.current.initialConfig?.defaultSubfolder).toBe('TV');
  });
});

describe('useConfig patched while the same field has unsaved edits', () => {
  const originalFetch = global.fetch;
  const KIDS = { subfolder: 'Kids', libraryId: '12' };
  const TV = { subfolder: 'TV', libraryId: '41' };

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ plexSubfolderLibraryMappings: [KIDS] }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('replaces the draft with the saved value', async () => {
    const { result } = renderHook(() => useConfig('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setConfig((prev) => ({ ...prev, plexSubfolderLibraryMappings: [] })); });

    act(() => {
      window.dispatchEvent(new CustomEvent(CONFIG_PATCHED_EVENT, { detail: { plexSubfolderLibraryMappings: [KIDS, TV] } }));
    });

    expect(result.current.config.plexSubfolderLibraryMappings).toEqual([KIDS, TV]);
  });
});
