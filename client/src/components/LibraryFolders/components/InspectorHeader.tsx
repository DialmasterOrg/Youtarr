import React, { useId, useState } from 'react';
import { Film, MoreHorizontal, Star, Tv } from '../../../lib/icons';
import { Button, Menu, MenuItem } from '../../ui';
import { cn } from '../../../lib/cn';
import type { LibraryFolder } from '../../../types/tvShows';
import { libraryFolderLabel } from '../../../utils/libraryLayouts';
import { useLibraryPage } from '../LibraryFoldersContext';
import { REORGANIZING_DEFAULT_TEXT } from '../folderText';
import { COPY_FAILED_MESSAGE, copyText } from '../copyText';
import { joinServerPath } from '../libraryTypes';

export interface InspectorHeaderProps {
  folder: LibraryFolder;
  headingRef: React.Ref<HTMLHeadingElement>;
  /** h1 on a detail screen, h2 in the two-column inspector */
  asPageTitle: boolean;
}

/** Name, path, Default chip, Make default and the overflow menu (UI 5.7.1, 6.3). */
export function InspectorHeader({ folder, headingRef, asPageTitle }: InspectorHeaderProps) {
  const page = useLibraryPage();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const reasonId = useId();
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

  return (
    <div className="px-4 pb-3.5 pt-4">
      <div className="flex items-start gap-2.5">
        <Icon size={asPageTitle ? 20 : 18} aria-hidden="true" className="mt-1 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
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
        </div>
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
          <MenuItem onClick={() => { setMenuAnchor(null); void page.check.refetch(); }} className={page.phone ? 'min-h-[44px]' : undefined}>
            Check media servers again
          </MenuItem>
        </Menu>
      </div>
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
