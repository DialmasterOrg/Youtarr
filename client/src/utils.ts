// A duration as its two largest units, leaving out a zero smaller one:
// "1h5m", "5m5s", "17s", "10m". Empty for an unknown duration.
export const formatDuration = (seconds: number | null): string => {
  const total = Math.floor(seconds ?? 0);
  if (total <= 0) return '';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return m > 0 ? `${h}h${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m${s}s` : `${m}m`;
  return `${s}s`;
};

// Format a date like YYYYMMDD to m/d/YYYY
// strip leading zeros from month and day
export const formatYTDate = (date: string | null) => {
  if (!date) return 'Unknown';
  const year = date.substring(0, 4);
  const month = parseInt(date.substring(4, 6));
  const day = parseInt(date.substring(6, 8));

  return `${month}/${day}/${year}`;
}
