import React, { useId } from 'react';
import { Film, Tv } from '../../../../lib/icons';
import { cn } from '../../../../lib/cn';
import type { LibraryLayout } from '../../../../types/tvShows';
import { folderKey } from '../../../../utils/libraryLayouts';
import { useLibraryPage } from '../../LibraryFoldersContext';
import { joinServerPath, serverLibraryType } from '../../libraryTypes';

const MAX_NAME_LENGTH = 100;
const VALID_NAME = /^[a-zA-Z0-9 _-]+$/;
const IDEAS = ['Comedy', 'News', 'Podcasts', 'Science'];
const GENERIC_LIBRARY = { videos: 'Plex Other Videos, Jellyfin or Emby Movies', tv: 'Plex TV Shows, Jellyfin Shows, Emby TV shows' };

/** The server's rules (subfolderValidation) in the dialog's words (UI 7.1). */
export function folderNameError(raw: string, existingNames: string[]): string | null {
  const name = raw.trim();
  if (!name) return null;
  if (name.startsWith('_')) return 'Leave out the underscores: Youtarr adds __ for you.';
  if (!VALID_NAME.test(name)) return 'Use letters, numbers, spaces, hyphens and underscores only.';
  if (name.length > MAX_NAME_LENGTH) return 'Use 100 characters or fewer.';
  if (name.toLowerCase() === 'playlists') return '"playlists" is reserved for Youtarr\'s playlist files.';
  if (existingNames.some((existing) => folderKey(existing) === folderKey(name))) return `There is already a folder named __${name}.`;
  return null;
}

const CARDS = {
  videos: {
    title: 'Videos', Icon: Film, description: "Youtarr's existing movie-style layout: each video a movie in its channel's folder.",
    tree: (name: string) => [`__${name}/`, '\u2514\u2500 Channel Name/', '   \u2514\u2500 Channel - Title - id/', '      \u2514\u2500 Channel - Title [id].mp4'],
  },
  tv: {
    title: 'TV shows', Icon: Tv, description: 'Each channel a show, each upload year a season. For series you watch in order.',
    tree: (name: string) => [`__${name}/`, '\u2514\u2500 Channel Name/', '   \u2514\u2500 Season 2026/', '      \u2514\u2500 S2026E09281530 - Title [id].mp4'],
  },
} as const;

export interface AddFolderNameStepProps {
  name: string;
  layout: LibraryLayout;
  error: string | null;
  onNameChange: (name: string) => void;
  onLayoutChange: (layout: LibraryLayout) => void;
}

export function AddFolderNameStep({ name, layout, error, onNameChange, onLayoutChange }: AddFolderNameStepProps) {
  const page = useLibraryPage();
  const inputId = useId();
  const helpId = useId();
  const groupName = useId();
  const shown = name.trim() || 'Name';
  const base = page.config.youtubeOutputDirectory || '';
  const ideas = IDEAS.filter((idea) => !page.folders.some((folder) => folderKey(folder.name) === folderKey(idea)));
  const libraryLine = (target: LibraryLayout) => (page.servers.length > 0
    ? page.servers.map((server) => serverLibraryType(server.serverType, target)).join(', ')
    : GENERIC_LIBRARY[target]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-[18px]">
      <div>
        <label htmlFor={inputId} className="text-[13px] font-semibold">Folder name</label>
        <div className={cn('mt-1 flex items-center rounded-ui border', error ? 'border-destructive' : 'border-border', page.phone ? 'h-11' : 'h-[38px]')}>
          <span aria-hidden="true" className="pl-2.5 font-mono text-muted-foreground">__</span>
          <input id={inputId} autoFocus value={name} onChange={(event) => onNameChange(event.target.value)}
            placeholder={layout === 'tv' ? 'Science Shows' : 'Cooking'} aria-invalid={error ? 'true' : undefined} aria-describedby={helpId}
            className={cn('h-full min-w-0 flex-1 bg-transparent px-1 outline-none', page.phone && 'text-base')} />
        </div>
        <p id={helpId} className={cn('mt-1 text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
          {error ?? `Youtarr creates ${base ? joinServerPath(base, shown) : `__${shown}`}. Name it after the library you'll make from it, or what it will hold.`}
        </p>
        {ideas.length > 0 && (
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            Ideas:
            {ideas.map((idea) => (
              <button key={idea} type="button" onClick={() => onNameChange(idea)}
                className={cn('rounded-ui border border-border px-2 text-foreground', page.phone ? 'min-h-[44px]' : 'h-[26px]')}>
                {idea}
              </button>
            ))}
          </p>
        )}
      </div>
      <fieldset>
        <legend className="text-[13px] font-semibold">Layout</legend>
        <div className={cn('mt-1.5 grid gap-3', page.phone ? 'grid-cols-1' : 'grid-cols-2')}>
          {(['videos', 'tv'] as const).map((value) => {
            const card = CARDS[value];
            const selected = layout === value;
            return (
              <label key={value} className={cn('flex cursor-pointer flex-col gap-1.5 rounded-ui border p-3', selected ? 'border-primary bg-primary/5' : 'border-border')}>
                <span className="flex items-center gap-2">
                  <input type="radio" name={groupName} value={value} checked={selected} onChange={() => onLayoutChange(value)} className="h-4 w-4 accent-[hsl(var(--primary-raw))]" />
                  <card.Icon size={16} aria-hidden="true" />
                  <span className="font-display text-[15px] font-semibold">{card.title}</span>
                </span>
                <span className="text-[12.5px] text-muted-foreground">{card.description}</span>
                {!page.phone && (
                  <span aria-hidden="true" className="whitespace-pre font-mono text-[10.5px] leading-4 text-muted-foreground">
                    {card.tree(shown).join('\n')}
                  </span>
                )}
                <span className="border-t border-border pt-1.5 text-xs text-muted-foreground">Library: {libraryLine(value)}</span>
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-[12.5px] text-muted-foreground">
          You can change it later. If the folder holds downloads by then, they move, and you review the move first.
        </p>
      </fieldset>
    </div>
  );
}
