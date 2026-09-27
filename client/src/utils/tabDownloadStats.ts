import { TabDownloadStats } from '../types/Channel';

export const PUBLIC_ONLY_NOTE =
  'Public videos only (members-only excluded). Upcoming, live, and region-blocked videos ' +
  'count toward the total, so a tab can stay just under 100%.';

export function formatTabPercent(stats?: TabDownloadStats): string | null {
  if (!stats || stats.percent === null) return null;
  // A few downloads out of thousands round down to 0, which reads as none.
  if (stats.percent === 0 && stats.downloaded > 0) return '<1%';
  return `${stats.percent}%`;
}

export function describeTabCounts(stats: TabDownloadStats): string {
  const parts = [`${stats.downloaded.toLocaleString()} of ${(stats.total ?? 0).toLocaleString()} downloaded`];
  if (stats.ignored > 0) parts.push(`${stats.ignored.toLocaleString()} ignored`);
  if (stats.loaded !== undefined) parts.push(`${stats.loaded.toLocaleString()} loaded`);
  return parts.join(', ');
}

export function describeTabStats(stats: TabDownloadStats): string {
  if (stats.total === null) return 'Not counted on YouTube yet.';
  return `${describeTabCounts(stats)}. ${PUBLIC_ONLY_NOTE}`;
}
