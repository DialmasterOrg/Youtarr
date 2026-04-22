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

const ADDED_DATE_SHORT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: '2-digit',
};

const ADDED_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
};

export function formatAddedDateParts(
  iso: string | null | undefined
): { date: string; time: string } | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return {
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString([], ADDED_TIME_OPTIONS),
  };
}

export function formatAddedDateTime(iso: string | null | undefined): string {
  const parts = formatAddedDateParts(iso);
  return parts ? `${parts.date} ${parts.time}` : '';
}

export function formatAddedDate(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const day = date.toLocaleDateString(undefined, ADDED_DATE_SHORT_OPTIONS);
  const time = date.toLocaleTimeString([], ADDED_TIME_OPTIONS);
  return `${day} ${time}`;
}
