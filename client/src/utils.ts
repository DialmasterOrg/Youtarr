export const formatDuration = (duration: number) => {
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);

  return hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`;
};

// Format a date like YYYYMMDD to m/d/YYYY
// strip leading zeros from month and day
export const formatYTDate = (date: string) => {
  const year = date.substring(0, 4);
  const month = parseInt(date.substring(4, 6));
  const day = parseInt(date.substring(6, 8));

  return `${month}/${day}/${year}`;
}
