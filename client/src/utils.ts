export const formatDuration = (duration: number | null) => {
  if (!duration) return 'Unknown';
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);

  return hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`;
};

export const formatDurationClock = (seconds: number | null): string => {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
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
