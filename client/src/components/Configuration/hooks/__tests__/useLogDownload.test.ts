import { act, renderHook } from '@testing-library/react';
import { useLogDownload } from '../useLogDownload';

jest.mock('axios', () => ({
  get: jest.fn(),
  isAxiosError: jest.fn(() => false),
}));

const axios = require('axios');

const DOWNLOAD_NAME = 'youtarr-logs-20260925T120000Z.log';

describe('useLogDownload', () => {
  let downloadedAs: string | null;

  beforeEach(() => {
    jest.clearAllMocks();
    downloadedAs = null;
    URL.createObjectURL = jest.fn(() => 'blob:logs');
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadedAs = this.download;
    });
    axios.isAxiosError.mockReturnValue(false);
    axios.get.mockResolvedValue({
      data: new Blob(['log line\n']),
      headers: { 'content-disposition': `attachment; filename="${DOWNLOAD_NAME}"` },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('requests the logs with the auth token', async () => {
    const { result } = renderHook(() => useLogDownload('tok'));

    await act(() => result.current.downloadLogs());

    expect(axios.get).toHaveBeenCalledWith('/api/logs/download', {
      headers: { 'x-access-token': 'tok' },
      responseType: 'blob',
    });
  });

  test('saves the file under the name the server sent', async () => {
    const { result } = renderHook(() => useLogDownload('tok'));

    await act(() => result.current.downloadLogs());

    expect(downloadedAs).toBe(DOWNLOAD_NAME);
  });

  test('explains when no log files exist yet', async () => {
    axios.get.mockRejectedValue({ response: { status: 404 } });
    axios.isAxiosError.mockReturnValue(true);
    const { result } = renderHook(() => useLogDownload('tok'));

    await act(() => result.current.downloadLogs());

    expect(result.current.error).toBe('No log files have been written yet.');
  });

  test('reports other failures', async () => {
    axios.get.mockRejectedValue(new Error('Network Error'));
    const { result } = renderHook(() => useLogDownload('tok'));

    await act(() => result.current.downloadLogs());

    expect(result.current.error).toBe('Could not download the logs.');
  });

  test('does nothing without a token', async () => {
    const { result } = renderHook(() => useLogDownload(null));

    await act(() => result.current.downloadLogs());

    expect(axios.get).not.toHaveBeenCalled();
  });
});
