import React, { useEffect, useId, useState } from 'react';
import { Button, MenuItem, Select } from '../../ui';
import { cn } from '../../../lib/cn';
import type { LibraryFolder } from '../../../types/tvShows';
import type { LibraryCheckServerReport } from '../../../types/libraryCheck';
import { holdingLibraries } from '../../../utils/libraryAttention';
import { useLibraryPage } from '../LibraryFoldersContext';
import { PLEX_MAPPING_SAVE_ERROR, usePlexRefreshMapping } from '../hooks/usePlexRefreshMapping';

const REFRESHABLE_TYPES = new Set(['movie', 'show']);

/** "After downloads here, Plex refreshes [library]" (UI 5.7.2.5); replaces the Settings > Plex table. */
export function PlexRefreshControl({ folder, report }: { folder: LibraryFolder; report: LibraryCheckServerReport | null }) {
  const { token, phone, config, plexLibraries, plexConnectionStatus } = useLibraryPage();
  const { saving, setMapping, removeMapping } = usePlexRefreshMapping(token);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const labelId = useId();
  const mapping = folder.plexMapping ?? { choice: 'none' as const, libraryId: null };
  const savedKey = `${mapping.choice}:${mapping.libraryId ?? ''}`;
  const defaultId = config.plexYoutubeLibraryId ? String(config.plexYoutubeLibraryId) : null;
  const titleOf = (id: string | null) => (id ? plexLibraries.find((library) => String(library.id) === id)?.title ?? null : null);
  const listed = plexConnectionStatus === 'connected' && plexLibraries.length > 0;
  // Until the connection test answers, Plex is neither listed nor unreachable.
  const plexKnown = plexConnectionStatus !== 'testing' && plexConnectionStatus !== 'not_tested';

  // The chosen value stays on screen after a save until the reloaded folder carries it.
  useEffect(() => { setPending(null); }, [savedKey]);

  const run = async (action: () => Promise<void>, value: string | null) => {
    setError(null);
    setPending(value);
    try {
      await action();
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : PLEX_MAPPING_SAVE_ERROR);
      setPending(null);
    }
  };
  const remove = mapping.choice !== 'none' ? (
    <Button variant="text" size="sm" disabled={saving} onClick={() => { void run(() => removeMapping(folder.name), null); }}
      className={phone ? 'min-h-[44px]' : undefined}>
      Remove setting
    </Button>
  ) : null;

  if (!listed || (mapping.libraryId !== null && titleOf(mapping.libraryId) === null)) {
    const shownId = mapping.libraryId ?? defaultId;
    const libraryText = titleOf(shownId) ?? (shownId ? `library ${shownId}` : 'no library');
    return (
      <div className="border-t border-border pt-2.5 text-[13px]">
        <span>After downloads here, Plex refreshes {libraryText}</span>{' '}
        {plexKnown && (
          <span className="text-muted-foreground">{listed ? '(Plex no longer lists this library)' : "(Plex couldn't be reached)"}</span>
        )}
        {remove}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  const options = plexLibraries
    .filter((library) => !library.type || REFRESHABLE_TYPES.has(library.type) || String(library.id) === mapping.libraryId)
    .sort((a, b) => a.title.localeCompare(b.title));
  const value = pending ?? (mapping.choice === 'library' && mapping.libraryId ? mapping.libraryId : '');
  const selectedId = value || defaultId;
  const holders = new Set((report ? holdingLibraries(report) : []).map((library) => library.id));
  const caption = selectedId && holders.has(selectedId)
    ? { className: 'text-success', text: 'Matches the library that holds this folder.' }
    : mapping.choice === 'default'
      ? { className: 'text-muted-foreground', text: "You chose the default library for this folder, so Youtarr won't change it." }
      : { className: 'text-muted-foreground', text: 'Folders without their own choice refresh the default library.' };

  return (
    <div className="border-t border-border pt-2.5">
      <div className={cn('flex gap-2', phone ? 'flex-col' : 'flex-wrap items-center')}>
        <span id={labelId} className="text-[13px]">After downloads here, Plex refreshes</span>
        <Select value={value} labelId={labelId} triggerRole="combobox" size="small" disabled={saving} fullWidth={phone}
          onChange={(event) => { const next = String(event.target.value); void run(() => setMapping(folder.name, next || null), next); }}
          className={phone ? 'min-h-[44px] text-[13px]' : 'h-[30px] min-h-0 text-[13px]'}>
          <MenuItem value="">{defaultId ? `Default library (${titleOf(defaultId) ?? `library ${defaultId}`})` : 'No default library (nothing refreshes)'}</MenuItem>
          {options.map((library) => <MenuItem key={library.id} value={String(library.id)}>{library.title}</MenuItem>)}
        </Select>
        {remove}
      </div>
      <p className={cn('mt-1 text-xs', error ? 'text-destructive' : caption.className)}>{error ?? caption.text}</p>
    </div>
  );
}
