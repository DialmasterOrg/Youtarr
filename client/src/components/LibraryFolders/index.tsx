import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui';
import { cn } from '../../lib/cn';
import type { ReorganizeChange } from '../../types/reorganize';
import type { LibraryFolder, LibraryLayout } from '../../types/tvShows';
import type { MediaServerType } from '../../types/libraryCheck';
import type { PlexLibrary } from '../../utils/plexLibraries';
import type { ConfigState, DeploymentEnvironment, PlatformManagedState, PlexConnectionStatus, SnackbarState } from '../Configuration/types';
import { useLibraryFolders } from '../../hooks/useLibraryFolders';
import { useLibraryCheck } from '../../hooks/useLibraryCheck';
import { useMediaServerStatus } from '../../hooks/useMediaServerStatus';
import { useContainerWidth } from '../../hooks/useContainerWidth';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { ReorganizeDialog, useActiveReorganize } from '../shared/Reorganize';
import { MainFolderTvDialog } from './components/dialogs/MainFolderTvDialog';
import { SERVER_ORDER, buildAttention, serversOf } from '../../utils/libraryAttention';
import { folderKey } from '../../utils/libraryLayouts';
import { HEADER_HEIGHT_DESKTOP } from '../layout/navLayoutConstants';
import { LibraryPageProvider, LibraryPageValue } from './LibraryFoldersContext';
import { useSelectedFolder } from './hooks/useSelectedFolder';
import { useLibraryFolderDetail } from './hooks/useLibraryFolderDetail';
import { useDefaultFolder } from './hooks/useDefaultFolder';
import { ReorganizeHandoffContext, useReorganizeHandoff } from './hooks/useReorganizeHandoff';
import { useLayoutChange } from './hooks/useLayoutChange';
import { folderLabel, otherLayout } from './folderText';
import { AttentionStrip } from './components/AttentionStrip';
import { CheckBanners } from './components/CheckBanners';
import { FolderDetailScreen } from './components/FolderDetailScreen';
import { FolderInspector } from './components/FolderInspector';
import { FolderShelf } from './components/FolderShelf';
import { LibraryGuide } from './components/LibraryGuide';
import { NoTvFoldersRow } from './components/NoTvFoldersRow';
import { PageHeader } from './components/PageHeader';
import { AddFolderDialog } from './components/dialogs/AddFolderDialog';
import { DeleteFolderDialog } from './components/dialogs/DeleteFolderDialog';
import { MakeDefaultDialog } from './components/dialogs/MakeDefaultDialog';
import { StartTvShowsDialog } from './components/dialogs/StartTvShowsDialog';

const TWO_COLUMN_MIN_WIDTH = 1012;
const PHONE_QUERY = '(max-width: 767px)';
const INCLUDE: Array<'usage' | 'files'> = ['usage', 'files'];
const INSPECTOR_GAP = 16;

export interface LibraryFoldersProps {
  token: string | null;
  config: ConfigState;
  isPlatformManaged: PlatformManagedState;
  deploymentEnvironment: DeploymentEnvironment;
  plexLibraries: PlexLibrary[];
  plexConnectionStatus: PlexConnectionStatus;
  setSnackbar: (state: SnackbarState) => void;
}

/** Settings > Library folders (/settings/library, /settings/library/:folder). */
export default function LibraryFolders({
  token, config, isPlatformManaged, deploymentEnvironment, plexLibraries, plexConnectionStatus, setSnackbar,
}: LibraryFoldersProps) {
  const [measureRef, width] = useContainerWidth<HTMLDivElement>();
  const twoColumn = width === null ? null : width >= TWO_COLUMN_MIN_WIDTH;
  const phone = useMediaQuery(PHONE_QUERY);
  const library = useLibraryFolders(token, { include: INCLUDE });
  const checkResult = useLibraryCheck(token);
  const { status: serverStatus, loading: serverStatusLoading } = useMediaServerStatus(token);
  const configuredServers = useMemo(() => SERVER_ORDER.filter((type) => serverStatus[type]), [serverStatus]);
  const { operation } = useActiveReorganize(token);
  const { detail: mainDetail } = useLibraryFolderDetail(token, '');
  const selection = useSelectedFolder({
    folders: library.folders, loaded: library.loaded, loading: library.loading, error: library.error, twoColumn,
  });
  const { readBackDefault } = useDefaultFolder(token);
  // The guide's default is decided once, here: the narrow detail screen unmounts the guide, and a
  // remount after the first TV folder was created would otherwise decide "folded".
  const [guideDefaultOpen, setGuideDefaultOpen] = useState<boolean | null>(null);
  if (guideDefaultOpen === null && library.loaded) {
    setGuideDefaultOpen(!phone && !library.folders.some((folder) => folder.layout === 'tv'));
  }
  const [addLayout, setAddLayout] = useState<LibraryLayout | null>(null);
  const [startTvOpen, setStartTvOpen] = useState(false);
  const [mainTvOpen, setMainTvOpen] = useState(false);
  const [makeDefaultFolder, setMakeDefaultFolder] = useState<LibraryFolder | null>(null);
  const [deleteFolder, setDeleteFolder] = useState<LibraryFolder | null>(null);
  const [focusTarget, setFocusTarget] = useState<LibraryPageValue['focusTarget']>(null);
  const [focusRow, setFocusRow] = useState<string | null>(null);
  const [deletedFocus, setDeletedFocus] = useState<LibraryFolder | null>(null);
  const shelfHeadings = useRef<Record<LibraryLayout, HTMLHeadingElement | null>>({ videos: null, tv: null });

  const { refetch: refetchFolders } = library;
  const { refetch: refetchCheck } = checkResult;
  const refreshAll = useCallback(() => {
    void refetchFolders();
    void refetchCheck();
  }, [refetchFolders, refetchCheck]);
  // useLayoutChange hands refusals to the reorganize hand-off, which reports
  // moves back to useLayoutChange: a ref breaks the cycle.
  const reviewRef = useRef<((change: ReorganizeChange, context: ReorganizeHandoffContext) => void) | null>(null);
  const reviewLater = useCallback((change: ReorganizeChange, context: ReorganizeHandoffContext) => reviewRef.current?.(change, context), []);
  const layoutChange = useLayoutChange({ token, setFolderLayout: library.setFolderLayout, review: reviewLater });
  const { settleMoving } = layoutChange;
  const onLayoutSettled = useCallback((folder: string, target: LibraryLayout) => { void settleMoving(folder, target); }, [settleMoving]);
  const handoff = useReorganizeHandoff(token, {
    onSettled: refreshAll, onLayoutMoving: layoutChange.showMoving, onLayoutSettled, readBackDefault,
  });
  reviewRef.current = handoff.review;
  const { trackedOperationId } = handoff;

  // Any reorganize ending (another tab's, or one running before the page opened) changes folders;
  // the hand-off refreshes for the one this page follows.
  const runningOperationId = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (operation) {
      runningOperationId.current = operation.id;
      return;
    }
    if (runningOperationId.current === undefined) return;
    const ended = runningOperationId.current;
    runningOperationId.current = undefined;
    if (ended === null || ended !== trackedOperationId) refreshAll();
  }, [operation, trackedOperationId, refreshAll]);

  const notify = useCallback((message: string, severity: SnackbarState['severity'] = 'success') => (
    setSnackbar({ open: true, message, severity })
  ), [setSnackbar]);
  const { data: checkData, loading: checkLoading, error: checkError, lastCheckedAt, applyPlexMapping } = checkResult;
  const check = useMemo(() => ({
    data: checkData, loading: checkLoading, error: checkError, lastCheckedAt, refetch: refetchCheck, applyPlexMapping,
  }), [checkData, checkLoading, checkError, lastCheckedAt, refetchCheck, applyPlexMapping]);
  const servers = useMemo(() => serversOf(check, configuredServers), [check, configuredServers]);
  const movingFolders = useMemo(() => {
    const change = operation?.change;
    if (!change) return [];
    if (change.type === 'folderLayout') return [folderKey(change.folder)];
    if (change.type === 'defaultSubfolder') return [folderKey(change.value), folderKey(change.previousValue ?? '')];
    return [];
  }, [operation]);

  const { select } = selection;
  const jumpTo = useCallback((folder: string, serverType?: MediaServerType) => {
    setFocusTarget({ folder, serverType });
    select(folder);
  }, [select]);
  const clearFocusTarget = useCallback(() => setFocusTarget(null), []);
  const openStartTv = useCallback(() => setStartTvOpen(true), []);
  const openMainFolderTv = useCallback(() => setMainTvOpen(true), []);
  const clearFocusRow = useCallback(() => setFocusRow(null), []);

  const value: LibraryPageValue = {
    token, config, isPlatformManaged, timeZone: deploymentEnvironment.timezone ?? null, phone, twoColumn: twoColumn === true,
    folders: library.folders, foldersLoaded: library.loaded, guideDefaultOpen, mainDetail, check, configuredServers,
    serversKnown: !serverStatusLoading || checkData !== null, servers, plexLibraries, plexConnectionStatus,
    reorganizing: Boolean(operation), movingFolders,
    layoutResult: layoutChange.result, busyLayoutFolder: layoutChange.busyFolder, changeLayout: layoutChange.changeLayout,
    selectFolder: select,
    openAddFolder: setAddLayout,
    openStartTv,
    openMainFolderTv,
    openMakeDefault: setMakeDefaultFolder,
    openDelete: setDeleteFolder,
    reviewChange: handoff.review,
    jumpTo,
    focusTarget,
    clearFocusTarget,
    notify,
  };

  const attention = buildAttention(library.folders, check, configuredServers);
  const tvFolders = library.folders.filter((folder) => folder.layout === 'tv');
  const videoFolders = library.folders.filter((folder) => folder.layout === 'videos');
  const main = library.folders.find((folder) => !folder.name);
  const shelfProps = {
    selectedName: selection.selected?.name ?? null,
    focusName: focusRow,
    onFocused: clearFocusRow,
  };
  // Keyed so the Video folders shelf keeps its own DOM and state when the TV shelf comes or goes.
  const videoShelf = (
    <FolderShelf key="videos" layout="videos" folders={videoFolders} {...shelfProps}
      headingRef={(element) => { shelfHeadings.current.videos = element; }} />
  );
  const shelves = tvFolders.length > 0 ? (
    <>
      <FolderShelf key="tv" layout="tv" folders={tvFolders} {...shelfProps} headingRef={(element) => { shelfHeadings.current.tv = element; }} />
      {videoShelf}
    </>
  ) : (
    <>{videoShelf}<NoTvFoldersRow key="no-tv" /></>
  );
  const body = library.error ? (
    <div role="alert" className="flex items-center gap-3 rounded-ui border border-destructive bg-card px-3 py-2.5 text-[13px]">
      <span className="flex-1">{library.error}</span>
      <Button variant="text" onClick={() => { void library.refetch(); }} className={phone ? 'min-h-[44px]' : undefined}>Retry</Button>
    </div>
  ) : !library.loaded ? (
    <div aria-busy="true" className="flex flex-col gap-4">
      {[0, 1].map((key) => <div key={key} className="h-32 animate-pulse rounded-ui border border-border bg-card" />)}
    </div>
  ) : shelves;

  const back = () => {
    setFocusRow(selection.selected?.name ?? null);
    selection.backToList();
  };
  const onDeleted = (folder: LibraryFolder) => {
    setDeleteFolder(null);
    notify(`Deleted ${folderLabel(folder.name)}`);
    setDeletedFocus(folder);
    selection.leaveFolder();
  };
  const selectedKey = selection.selected ? folderKey(selection.selected.name) || '~main' : null;
  const detailKey = twoColumn === false ? selectedKey : null;
  const shelvesShown = twoColumn !== null && detailKey === null && library.loaded && !library.error;

  // After a delete, focus the heading of the shelf the folder was on (UI 10) once the
  // refetched list no longer holds it; deleting the last TV folder removes that shelf.
  useEffect(() => {
    if (!deletedFocus) return;
    if (library.error) {
      setDeletedFocus(null);
      return;
    }
    if (!shelvesShown || library.folders.some((folder) => folderKey(folder.name) === folderKey(deletedFocus.name))) return;
    (shelfHeadings.current[deletedFocus.layout] ?? shelfHeadings.current[otherLayout(deletedFocus.layout)])?.focus();
    setDeletedFocus(null);
  }, [deletedFocus, shelvesShown, library.folders, library.error]);

  // A detail screen opens at the top of the window, so its back bar is in view.
  useEffect(() => {
    if (detailKey !== null) window.scrollTo(0, 0);
  }, [detailKey]);

  return (
    <LibraryPageProvider value={value}>
      <div className={cn('mx-auto w-full max-w-[1088px]', phone ? 'px-4 pb-6 pt-4' : 'px-6 pb-16 pt-5')}>
        {/* No padding here: the two-column breakpoint measures the content box. */}
        <div ref={measureRef}>
          {detailKey !== null && selection.selected ? (
            <FolderDetailScreen folder={selection.selected} onBack={back} />
          ) : (
            <div className={cn('flex flex-col gap-4', twoColumn === false && 'mx-auto max-w-[720px]')}>
              <PageHeader />
              <CheckBanners missingName={selection.missingName} onDismissMissing={selection.dismissMissing} />
              <LibraryGuide />
              {check.data && <AttentionStrip items={attention} />}
              {twoColumn ? (
                <div className="grid grid-cols-[minmax(560px,1fr)_432px] items-start gap-5">
                  <div className="flex flex-col gap-4">{body}</div>
                  {/* Keyed by folder: the aside is the scroll container, so a new folder starts at the top. */}
                  <aside key={selectedKey ?? '~none'} id="library-inspector" aria-labelledby="insp-title"
                    className="sticky overflow-y-auto overscroll-contain rounded-ui border border-border bg-card"
                    style={{ top: HEADER_HEIGHT_DESKTOP + INSPECTOR_GAP, maxHeight: `calc(100vh - ${HEADER_HEIGHT_DESKTOP + 2 * INSPECTOR_GAP}px)` }}>
                    {selection.selected ? (
                      <FolderInspector folder={selection.selected} />
                    ) : (
                      <div aria-busy="true" className="h-64 animate-pulse" />
                    )}
                  </aside>
                </div>
              ) : (
                twoColumn === false && <div className="flex flex-col gap-4">{body}</div>
              )}
            </div>
          )}
        </div>
      </div>
      {addLayout && (
        <AddFolderDialog open initialLayout={addLayout} onClose={() => setAddLayout(null)}
          onCreated={(name) => select(name)}
          onNeedsReview={(change, name) => {
            setAddLayout(null);
            select(name);
            handoff.review(change, { kind: 'create', folder: name, target: 'tv' });
          }} />
      )}
      {startTvOpen && <StartTvShowsDialog open onClose={() => setStartTvOpen(false)} />}
      {makeDefaultFolder && <MakeDefaultDialog folder={makeDefaultFolder} onClose={() => setMakeDefaultFolder(null)} />}
      {deleteFolder && <DeleteFolderDialog folder={deleteFolder} onClose={() => setDeleteFolder(null)} onDeleted={onDeleted} />}
      <MainFolderTvDialog open={mainTvOpen} confirmLabel={main?.layoutChangeNeedsReview ? 'Review the move' : 'Use for TV shows'}
        busy={layoutChange.busyFolder === ''} onCancel={() => setMainTvOpen(false)}
        onConfirm={() => { setMainTvOpen(false); void layoutChange.changeLayout('', 'tv'); }} />
      <ReorganizeDialog token={token} {...handoff.dialogProps} />
    </LibraryPageProvider>
  );
}
