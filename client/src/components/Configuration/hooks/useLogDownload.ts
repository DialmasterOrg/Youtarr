import { useCallback, useState } from 'react';
import axios from 'axios';

const LOG_DOWNLOAD_URL = '/api/logs/download';
const FALLBACK_FILENAME = 'youtarr-logs.log';
// Revoking right after click() can cancel the download in some browsers.
const OBJECT_URL_REVOKE_DELAY_MS = 10000;
const FILENAME_PATTERN = /filename="([^"]+)"/;

function filenameFromDisposition(header: string | undefined): string {
  const match = header ? FILENAME_PATTERN.exec(header) : null;
  return match ? match[1] : FALLBACK_FILENAME;
}

function describeError(err: unknown): string {
  if (axios.isAxiosError(err) && err.response?.status === 404) {
    return 'No log files have been written yet.';
  }
  return 'Could not download the logs.';
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_REVOKE_DELAY_MS);
}

export function useLogDownload(token: string | null) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadLogs = useCallback(async () => {
    if (!token) return;
    setDownloading(true);
    setError(null);
    try {
      // A plain link cannot send x-access-token, so fetch the file as a blob.
      const response = await axios.get<Blob>(LOG_DOWNLOAD_URL, {
        headers: { 'x-access-token': token },
        responseType: 'blob',
      });
      saveBlob(response.data, filenameFromDisposition(response.headers['content-disposition']));
    } catch (err: unknown) {
      setError(describeError(err));
    } finally {
      setDownloading(false);
    }
  }, [token]);

  return { downloading, error, downloadLogs };
}
