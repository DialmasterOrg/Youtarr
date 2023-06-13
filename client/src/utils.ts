export const formatDuration = (duration: number) => {
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);

  return hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`;
};