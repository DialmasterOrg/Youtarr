import React, { useEffect, useRef } from 'react';
import type { LibraryFolder } from '../../../types/tvShows';
import { folderKey } from '../../../utils/libraryLayouts';
import { useLibraryPage } from '../LibraryFoldersContext';
import { useLibraryFolderDetail } from '../hooks/useLibraryFolderDetail';
import { DownloadsHereSection } from './DownloadsHereSection';
import { InspectorHeader } from './InspectorHeader';
import { LayoutSection } from './LayoutSection';
import { MediaServersSection } from './MediaServersSection';

/**
 * The selected folder: Media servers, Downloads here, then Layout, which changes least; Delete is in the header's
 * menu (UI 5.7). Remounted per folder so its preview resets: the page keys the scrolling inspector aside by folder
 * (a new folder starts at the top), the detail screen keys this component.
 */
export function FolderInspector({ folder, asPageTitle = false }: { folder: LibraryFolder; asPageTitle?: boolean }) {
  const page = useLibraryPage();
  // The page already loads the main folder's detail.
  const { detail: ownDetail } = useLibraryFolderDetail(page.token, folder.name ? folder.name : null);
  const detail = folder.name ? ownDetail : page.mainDetail;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { focusTarget, clearFocusTarget } = page;

  useEffect(() => {
    if (!focusTarget || folderKey(focusTarget.folder) !== folderKey(folder.name)) return;
    headingRef.current?.focus({ preventScroll: true });
    if (focusTarget.serverType) {
      // jsdom does not implement scrollIntoView
      document.getElementById(`server-card-${focusTarget.serverType}`)?.scrollIntoView?.({ block: 'nearest' });
    }
    clearFocusTarget();
  }, [focusTarget, clearFocusTarget, folder.name]);

  return (
    <div className="flex flex-col divide-y divide-border">
      <InspectorHeader folder={folder} headingRef={headingRef} asPageTitle={asPageTitle} />
      <MediaServersSection folder={folder} />
      <DownloadsHereSection folder={folder} detail={detail} />
      <LayoutSection folder={folder} detail={detail} />
    </div>
  );
}
