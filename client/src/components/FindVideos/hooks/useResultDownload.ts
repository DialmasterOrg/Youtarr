import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTriggerDownloads } from '../../../hooks/useTriggerDownloads';
import { isRemovedStatus } from '../../../utils/videoStatus';
import { DownloadSettings } from '../../DownloadManager/ManualDownload/types';
import { VideoSelectionState } from '../../shared/VideoList/hooks/useVideoSelection';
import { SearchResult } from '../types';

const QUEUE_FAILED_MESSAGE = 'Failed to queue selected videos. Please try again.';

type ActiveVideos = Record<string, { state?: string | null } | undefined>;

// Which videos the dialog is for: the multi-selection, or one row's button.
type Target = { kind: 'selection' } | { kind: 'one'; youtubeId: string };

interface UseResultDownloadOptions {
  token: string | null;
  results: SearchResult[];
  selection: VideoSelectionState<string>;
  activeVideos: ActiveVideos;
}

export interface ResultDownload {
  dialogOpen: boolean;
  targetIds: string[];
  missingVideoCount: number;
  error: string | null;
  clearError: () => void;
  openForSelection: () => void;
  openForOne: (result: SearchResult) => void;
  close: () => void;
  confirm: (settings: DownloadSettings | null) => Promise<void>;
}

function toOverrideSettings(settings: DownloadSettings | null) {
  if (!settings) return undefined;
  return {
    resolution: settings.resolution,
    allowRedownload: settings.allowRedownload,
    subfolder: settings.subfolder,
    audioFormat: settings.audioFormat,
    rating: settings.rating,
    skipVideoFolder: settings.skipVideoFolder,
  };
}

export function useResultDownload({ token, results, selection, activeVideos }: UseResultDownloadOptions): ResultDownload {
  const navigate = useNavigate();
  const { triggerDownloads } = useTriggerDownloads(token);
  const [target, setTarget] = useState<Target | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetIds = useMemo(() => {
    if (!target) return [];
    return target.kind === 'one' ? [target.youtubeId] : selection.selectedIds;
  }, [target, selection.selectedIds]);

  // Removed or archive-only videos need "Allow re-downloading" or yt-dlp skips them.
  const missingVideoCount = useMemo(() => {
    const targets = new Set(targetIds);
    return results.filter((r) => targets.has(r.youtubeId) && (isRemovedStatus(r.status) || r.inArchive)).length;
  }, [results, targetIds]);

  const openForSelection = useCallback(() => {
    setError(null);
    setTarget({ kind: 'selection' });
  }, []);

  const openForOne = useCallback((result: SearchResult) => {
    setError(null);
    setTarget({ kind: 'one', youtubeId: result.youtubeId });
  }, []);

  const close = useCallback(() => setTarget(null), []);

  const confirm = useCallback(async (settings: DownloadSettings | null) => {
    const current = target;
    setTarget(null);
    if (!current) return;
    const ids = targetIds.filter((id) => !activeVideos[id]?.state);
    if (ids.length === 0) return;
    const urls = ids.map((id) => `https://www.youtube.com/watch?v=${id}`);
    const success = await triggerDownloads({ urls, overrideSettings: toOverrideSettings(settings) });
    if (success === null) return;
    if (!success) {
      setError(QUEUE_FAILED_MESSAGE);
      return;
    }
    if (current.kind === 'selection') selection.clear();
    navigate('/downloads/activity');
  }, [target, targetIds, activeVideos, triggerDownloads, selection, navigate]);

  return {
    dialogOpen: target !== null,
    targetIds,
    missingVideoCount,
    error,
    clearError: () => setError(null),
    openForSelection,
    openForOne,
    close,
    confirm,
  };
}
