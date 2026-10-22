import { formatDate, stripInternalPath } from './formatters';

// Why a video has no file, layered on the `removed` flag. Mirrors
// server/modules/videoRemovalState.js: a removed row whose reason is
// 'not_found' is MISSING (Youtarr expected a file and could not find it);
// any other removed row, including one with no recorded reason (removed
// before Youtarr kept track), is DELETED.
export type RemovalReason = 'user_deleted' | 'auto_removal' | 'not_found' | 'marked_deleted';
export type RemovalState = 'present' | 'deleted' | 'missing';
export type RemovedState = Exclude<RemovalState, 'present'>;

export interface RemovalInfo {
  reason: RemovalReason | null;
  at: string | null;
  detail: string | null;
}

// The removal columns as listing rows carry them (snake_case, as stored).
export interface RemovalRow {
  removed?: boolean | null;
  removed_reason?: string | null;
  removed_at?: string | Date | null;
  removed_detail?: string | null;
  filePath?: string | null;
}

// Neutral tint for a deleted video's thumbnail; missing keeps the red tint.
export const DELETED_OVERLAY_BACKGROUND = 'rgba(0, 0, 0, 0.35)';

const NO_REMOVAL: RemovalInfo = { reason: null, at: null, detail: null };

export function removedState(reason: string | null | undefined): RemovedState {
  return reason === 'not_found' ? 'missing' : 'deleted';
}

export function getRemovalState(removed: boolean | null | undefined, reason: string | null | undefined): RemovalState {
  if (!removed) return 'present';
  return removedState(reason);
}

export function removalFromRow(row: RemovalRow): RemovalInfo {
  const at = row.removed_at instanceof Date ? row.removed_at.toISOString() : row.removed_at;
  return {
    reason: (row.removed_reason as RemovalReason | null | undefined) ?? null,
    at: at ?? null,
    detail: row.removed_detail ?? null,
  };
}

const CAN_REDOWNLOAD = 'It can be downloaded again.';

// Where Settings > Maintenance cleans up deleted and missing videos.
export const REMOVED_VIDEOS_ANCHOR = 'deleted-and-missing';
export const REMOVED_VIDEOS_SETTINGS_PATH = `/settings/maintenance#${REMOVED_VIDEOS_ANCHOR}`;

export interface MissingDescription {
  // The path as the user knows it, or null when none is stored.
  path: string | null;
  // Everything after the path: "and could not find it ...".
  rest: string;
}

// The missing-file sentence in pieces, so a tooltip can set the path apart.
export function describeMissing(info: RemovalInfo = NO_REMOVAL, filePath?: string | null): MissingDescription {
  const date = info.at ? formatDate(info.at) : null;
  const checked = date ? ` (checked ${date})` : '';
  return {
    path: filePath ? stripInternalPath(filePath) : null,
    rest: `and could not find it${checked}. If the drive is mounted and the file is really gone, mark it as deleted.`,
  };
}

export function describeRemoval(state: RemovalState, info: RemovalInfo = NO_REMOVAL, filePath?: string | null): string {
  if (state === 'present') return 'Video file exists on disk';

  if (state === 'missing') {
    const { path, rest } = describeMissing(info, filePath);
    return `Youtarr expected a file${path ? ` at ${path}` : ''} ${rest}`;
  }

  const date = info.at ? formatDate(info.at) : null;
  const on = date ? ` on ${date}` : '';

  switch (info.reason) {
    case 'user_deleted':
      return `Deleted in Youtarr${on}. ${CAN_REDOWNLOAD}`;
    case 'auto_removal':
      return `Deleted by automatic cleanup${on}${info.detail ? ` (${info.detail})` : ''}. ${CAN_REDOWNLOAD}`;
    case 'marked_deleted':
      return `Marked as deleted${on}. Its file was missing from disk when it was marked. ${CAN_REDOWNLOAD}`;
    default:
      return `Removed before Youtarr recorded why. ${CAN_REDOWNLOAD}`;
  }
}

export function describeRow(row: RemovalRow): string {
  return describeRemoval(getRemovalState(row.removed, row.removed_reason), removalFromRow(row), row.filePath);
}
