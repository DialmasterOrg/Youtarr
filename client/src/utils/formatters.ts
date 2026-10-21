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

// Where the container keeps the downloads folder. The host path differs per
// install, so paths shown to users drop this prefix.
export const INTERNAL_PATH_PREFIX = '/usr/src/app/data/';

export function stripInternalPath(filePath: string): string {
  return filePath.startsWith(INTERNAL_PATH_PREFIX) ? filePath.slice(INTERNAL_PATH_PREFIX.length) : filePath;
}

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

// Convert yt-dlp's YYYYMMDD upload_date into a UTC-midnight ISO string, matching
// how the backend stores channelvideos.publishedAt (so an override set on the
// client renders identically to a value fetched from the server). Strings that
// are already ISO pass through. Returns null if unparseable.
export function uploadDateToIso(dateStr: string | null | undefined): string | null {
  if (!dateStr) {
    return null;
  }
  if (/^\d{8}$/.test(dateStr)) {
    const iso = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}T00:00:00.000Z`;
    return isNaN(new Date(iso).getTime()) ? null : iso;
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
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

// formatDateTime rendered in an explicit IANA zone (the server's), so times
// labeled "server time" read correctly from any browser. Falls back to the
// browser zone when the name is missing or unknown.
export function formatDateTimeInZone(
  dateStr: string | null | undefined,
  timeZone: string | null | undefined
): string | null {
  const date = parseDate(dateStr);
  if (!date) {
    return null;
  }
  if (!timeZone) {
    return formatDateTime(dateStr);
  }
  try {
    return `${date.toLocaleDateString(undefined, { timeZone })} ${date.toLocaleTimeString(undefined, { ...DATE_TIME_OPTIONS, timeZone })}`;
  } catch {
    return formatDateTime(dateStr);
  }
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

// "12.5K", "1.5M": YouTube-style abbreviation for view, like, and subscriber counts.
export function formatCompactCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return count.toLocaleString();
}

const DAY_MS = 86_400_000;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

// "3 days ago", "2 weeks ago", "5 years ago": the precision YouTube itself
// shows, which also matches what yt-dlp's approximate search dates carry.
export function formatRelativeDate(iso: string | null | undefined, now: Date = new Date()): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.floor((now.getTime() - date.getTime()) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < DAYS_PER_WEEK) return plural(days, 'day');
  if (days < DAYS_PER_MONTH) return plural(Math.floor(days / DAYS_PER_WEEK), 'week');
  if (days < DAYS_PER_YEAR) return plural(Math.floor(days / DAYS_PER_MONTH), 'month');
  return plural(Math.floor(days / DAYS_PER_YEAR), 'year');
}
