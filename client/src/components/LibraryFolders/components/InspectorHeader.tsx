import React, { useId, useState } from 'react';
import { Film, MoreHorizontal, Star, Trash2, Tv } from '../../../lib/icons';
import { Button, Menu, MenuItem } from '../../ui';
import { cn } from '../../../lib/cn';
import type { LibraryFolder } from '../../../types/tvShows';
import { libraryFolderLabel } from '../../../utils/libraryLayouts';
import { useLibraryPage } from '../LibraryFoldersContext';
import { REORGANIZING_DEFAULT_TEXT, SEP, deleteReasonText, filesSummary, layoutName } from '../folderText';
import { COPY_FAILED_MESSAGE, copyText } from '../copyText';
import { joinServerPath } from '../libraryTypes';

export interface InspectorHeaderProps {
  folder: LibraryFolder;
  headingRef: React.Ref<HTMLHeadingElement>;
  /** h1 on a detail screen, h2 in the two-column inspector */
  asPageTitle: boolean;
}

/**
 * Kind, name, path, layout and on-disk count, Make default and the overflow menu with Delete (UI 5.7.1, 6.3). Its tint
 * matches the selected row's, so the panel reads as that row's detail.
 */
export function InspectorHeader({ folder, headingRef, asPageTitle }: InspectorHeaderProps) {
  const page = useLibraryPage();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const reasonId = useId();
  const deleteReasonId = useId();
  const label = libraryFolderLabel(folder.name);
  const base = page.config.youtubeOutputDirectory || '';
  const fullPath = base ? joinServerPath(base, folder.name) : (folder.name ? `__${folder.name}` : 'the downloads folder');
  const Icon = folder.layout === 'tv' ? Tv : Film;
  const Heading = asPageTitle ? 'h1' : 'h2';

  const copyPath = async () => {
    setMenuAnchor(null);
    if (await copyText(fullPath)) page.notify('Copied');
    else page.notify(COPY_FAILED_MESSAGE, 'error');
  };

  const deletable = Boolean(folder.deletable);
  const openDelete = () => {
    setMenuAnchor(null);
    page.openDelete(folder);
  };

  return (
    <div className="bg-primary/[0.07] px-4 pb-3.5 pt-3 motion-safe:animate-select-flash">
      <div className="flex items-center gap-2">
        <Icon size={14} aria-hidden="true" className="shrink-0 text-primary" />
        <span className="text-[11px] font-bold uppercase tracking-[.08em] text-primary">{folder.layout === 'tv' ? 'TV show folder' : 'Video folder'}</span>
        <span className="flex-1" />
        {!page.phone && !folder.isDefault && (
          <Button variant="outlined" size="sm" startIcon={<Star size={14} aria-hidden="true" />}
            aria-disabled={page.reorganizing ? 'true' : undefined} aria-describedby={page.reorganizing ? reasonId : undefined}
            onClick={() => { if (!page.reorganizing) page.openMakeDefault(folder); }}
            className={cn('h-[30px] shrink-0', page.reorganizing && 'opacity-50')}>
            Make default
          </Button>
        )}
        <Button variant="outlined" size="sm" aria-label={`More actions for ${label}`} aria-haspopup="menu" aria-expanded={Boolean(menuAnchor)}
          onClick={(event: React.MouseEvent<HTMLElement>) => setMenuAnchor(event.currentTarget)}
          className={page.phone ? 'h-11 w-11 shrink-0 p-0' : 'h-[30px] w-[30px] shrink-0 p-0'}>
          <MoreHorizontal size={16} aria-hidden="true" />
        </Button>
        <Menu open={Boolean(menuAnchor)} anchorEl={menuAnchor} onClose={() => setMenuAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          <MenuItem onClick={() => { void copyPath(); }} className={page.phone ? 'min-h-[44px]' : undefined}>Copy full path</MenuItem>
          <MenuItem divider={Boolean(folder.name)} onClick={() => { setMenuAnchor(null); void page.check.refetch(); }} className={page.phone ? 'min-h-[44px]' : undefined}>
            Check media servers again
          </MenuItem>
          {folder.name && (
            <MenuItem disabled={!deletable} aria-describedby={deletable ? undefined : deleteReasonId} onClick={openDelete}
              className={cn(deletable && 'text-destructive', page.phone && 'min-h-[44px]')}>
              <Trash2 size={14} aria-hidden="true" />Delete folder...
            </MenuItem>
          )}
          {folder.name && !deletable && (
            <p id={deleteReasonId} role="presentation" className="max-w-[280px] whitespace-normal px-3 pb-1.5 text-xs text-muted-foreground">
              {deleteReasonText(folder)}
            </p>
          )}
        </Menu>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-2">
        <Heading id="insp-title" ref={headingRef} tabIndex={-1}
          className={cn('font-display font-semibold [overflow-wrap:anywhere] focus:outline-none', asPageTitle ? 'text-[22px]' : 'text-xl')}>
          {label}
        </Heading>
        {folder.isDefault && (
          <span className="inline-flex items-center gap-1 rounded-ui border border-primary px-1.5 text-xs text-primary">
            <Star size={11} aria-hidden="true" />Default folder
          </span>
        )}
      </div>
      <p className="mt-0.5 font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{fullPath}</p>
      <p className="mt-1.5 text-[12.5px]">{layoutName(folder.layout)} layout{SEP}{filesSummary(folder) ?? 'Nothing on disk'}</p>
      {page.phone && !folder.isDefault && (
        <Button variant="outlined" startIcon={<Star size={14} aria-hidden="true" />}
          aria-disabled={page.reorganizing ? 'true' : undefined} aria-describedby={page.reorganizing ? reasonId : undefined}
          onClick={() => { if (!page.reorganizing) page.openMakeDefault(folder); }}
          className={cn('mt-3 min-h-[44px] w-full', page.reorganizing && 'opacity-50')}>
          Make default
        </Button>
      )}
      {page.reorganizing && !folder.isDefault && <p id={reasonId} className="mt-1.5 text-xs text-muted-foreground">{REORGANIZING_DEFAULT_TEXT}</p>}
    </div>
  );
}
