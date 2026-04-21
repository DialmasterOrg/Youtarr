export const formatFileSize = (bytes: number | null | undefined): string => {
  if (!bytes) {
    return '';
  }
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)}GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)}MB`;
};

export const decodeHtml = (html: string): string => {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
};

export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) {
    return null;
  }
  // yt-dlp writes upload_date as YYYYMMDD
  if (/^\d{8}$/.test(dateStr)) {
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1;
    const day = parseInt(dateStr.substring(6, 8), 10);
    return new Date(year, month, day);
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(dateStr: string | null | undefined): string | null {
  const date = parseDate(dateStr);
  return date ? date.toLocaleDateString() : null;
}

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
};

export function formatDateTime(dateStr: string | null | undefined): string | null {
  const date = parseDate(dateStr);
  if (!date) {
    return null;
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString(undefined, DATE_TIME_OPTIONS)}`;
}
