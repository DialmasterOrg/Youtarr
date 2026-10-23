import { useCallback, useState } from 'react';
import axios from 'axios';
import type { LibraryFoldersResponse, LibraryLayout } from '../../../types/tvShows';
import type { ReorganizeChange } from '../../../types/reorganize';
import { folderKey } from '../../../utils/libraryLayouts';
import { isReorganizeRequired } from '../../shared/Reorganize';
import { layoutName, movingNotice } from '../folderText';
import type { ReorganizeHandoffContext } from './useReorganizeHandoff';

export interface LayoutResult {
  folder: string;
  tone: 'success' | 'warning' | 'info';
  text: string;
}

interface Options {
  token: string | null;
  setFolderLayout: (name: string, layout: LibraryLayout) => Promise<void>;
  review: (change: ReorganizeChange, context: ReorganizeHandoffContext) => void;
}

const switchedResult = (folder: string, target: LibraryLayout): LayoutResult => (
  { folder, tone: 'success', text: `Now a ${layoutName(target)} folder.` }
);

/** Folder layout changes from the page: the result line, and the hand-off when files must move (UI 5.7.3). */
export function useLayoutChange({ token, setFolderLayout, review }: Options) {
  const [busyFolder, setBusyFolder] = useState<string | null>(null);
  const [result, setResult] = useState<LayoutResult | null>(null);

  const changeLayout = useCallback(async (name: string, target: LibraryLayout) => {
    setBusyFolder(name);
    setResult(null);
    try {
      await setFolderLayout(name, target);
      setResult(switchedResult(name, target));
    } catch (err: unknown) {
      if (isReorganizeRequired(err)) {
        review(err.change, { kind: 'layout', folder: name, target });
      } else {
        setResult({ folder: name, tone: 'warning', text: err instanceof Error ? err.message : 'Failed to change the folder layout' });
      }
    } finally {
      setBusyFolder(null);
    }
  }, [setFolderLayout, review]);

  const showMoving = useCallback((folder: string, target: LibraryLayout) => {
    setResult({ folder, tone: 'info', text: movingNotice(folder, target) });
  }, []);

  // A move ended: the server undoes the layout change when nothing could move, so read the layout back.
  const settleMoving = useCallback(async (folder: string, target: LibraryLayout) => {
    let layout: LibraryLayout | null = null;
    try {
      const response = await axios.get<LibraryFoldersResponse>('/api/library-folders', {
        headers: { 'x-access-token': token || '' },
      });
      layout = response.data.folders.find((entry) => folderKey(entry.name) === folderKey(folder))?.layout ?? null;
    } catch {
      layout = null;
    }
    setResult((current) => {
      if (!current || current.tone !== 'info' || folderKey(current.folder) !== folderKey(folder)) return current;
      return layout === target ? switchedResult(current.folder, target) : null;
    });
  }, [token]);

  return { busyFolder, result, changeLayout, showMoving, settleMoving };
}
