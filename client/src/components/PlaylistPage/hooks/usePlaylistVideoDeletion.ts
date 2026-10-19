import { useCallback, useState } from 'react';
import { useVideoDeletion } from '../../shared/useVideoDeletion';

interface UsePlaylistVideoDeletionOptions {
  token: string | null;
  markVideoDeleted: (youtubeId: string) => void;
  refetchMeta: () => Promise<void>;
}

export interface PlaylistDeletionOutcome {
  deletedIds: string[];
  message: string;
  severity: 'success' | 'warning' | 'error';
}

function videoCount(count: number): string {
  return `${count} video${count === 1 ? '' : 's'}`;
}

function describeOutcome(
  deletedCount: number,
  failed: Array<{ error: string }>
): Omit<PlaylistDeletionOutcome, 'deletedIds'> {
  if (failed.length === 0) {
    return { message: `Deleted ${videoCount(deletedCount)}`, severity: 'success' };
  }
  const reason = failed[0]?.error || 'Unknown error';
  if (deletedCount > 0) {
    return {
      message: `Deleted ${videoCount(deletedCount)}; ${failed.length} could not be deleted: ${reason}`,
      severity: 'warning',
    };
  }
  return { message: `Failed to delete ${failed.length === 1 ? 'video' : 'videos'}: ${reason}`, severity: 'error' };
}

/**
 * Confirm-then-delete flow for downloaded playlist videos. Deleted rows are
 * updated in place, so a long (paginated) list keeps its scroll position.
 */
export function usePlaylistVideoDeletion({ token, markVideoDeleted, refetchMeta }: UsePlaylistVideoDeletionOptions) {
  const { deleteVideosByYoutubeIds, loading } = useVideoDeletion();
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const requestDelete = useCallback((youtubeIds: string[]) => {
    if (youtubeIds.length === 0) return;
    setPendingIds(youtubeIds);
    setDialogOpen(true);
  }, []);

  const cancelDelete = useCallback(() => setDialogOpen(false), []);

  const confirmDelete = async (): Promise<PlaylistDeletionOutcome | null> => {
    setDialogOpen(false);
    if (pendingIds.length === 0) return null;
    const result = await deleteVideosByYoutubeIds(pendingIds, token);
    const deletedIds = result.deleted.map(String);
    deletedIds.forEach((id) => markVideoDeleted(id));
    if (deletedIds.length > 0) await refetchMeta();
    return { deletedIds, ...describeOutcome(deletedIds.length, result.failed) };
  };

  return {
    dialogOpen,
    pendingCount: pendingIds.length,
    loading,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
