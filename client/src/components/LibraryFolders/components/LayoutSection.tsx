import React, { useEffect, useId, useState } from 'react';
import { Film, Info, CheckCircle, Tv, Warning } from '../../../lib/icons';
import { Button, CircularProgress, SegmentedControl } from '../../ui';
import { cn } from '../../../lib/cn';
import type { LibraryFolder, LibraryFolderDetail, LibraryLayout } from '../../../types/tvShows';
import { folderKey } from '../../../utils/libraryLayouts';
import { useLibraryPage } from '../LibraryFoldersContext';
import { folderLabel, layoutConsequence, layoutName, otherLayout, verbLabel } from '../folderText';
import { AfterwardsNote } from './AfterwardsNote';
import { LayoutPreviewTree } from './LayoutPreviewTree';
import { SectionHeading } from './SectionHeading';

const MAIN_TV_WARNING = 'Youtarr writes a .plexignore here so a Plex TV library skips your __subfolders. Jellyfin and Emby '
  + "can't skip them and would show each __subfolder as an extra show.";
const RESULT_ICONS = { success: CheckCircle, warning: Warning, info: Info };
const RESULT_TONES = { success: 'text-success', warning: 'text-warning', info: 'text-info' };

/** Layout: the current layout, Preview as, the example tree, and the change (UI 5.7.3). */
export function LayoutSection({ folder, detail }: { folder: LibraryFolder; detail: LibraryFolderDetail | null }) {
  const page = useLibraryPage();
  const headingId = useId();
  const consequenceId = useId();
  const [preview, setPreview] = useState<LibraryLayout | null>(null);
  useEffect(() => {
    setPreview(null);
  }, [folder.name, folder.layout]);
  const target = otherLayout(folder.layout);
  const previewing = preview === target;
  const shown = previewing ? target : folder.layout;
  const consequence = layoutConsequence({ folder, titleShows: detail?.titleShows ?? null, reorganizing: page.reorganizing });
  const busy = page.busyLayoutFolder !== null && folderKey(page.busyLayoutFolder) === folderKey(folder.name);
  const result = page.layoutResult && folderKey(page.layoutResult.folder) === folderKey(folder.name) ? page.layoutResult : null;
  const CurrentIcon = folder.layout === 'tv' ? Tv : Film;
  const TargetIcon = target === 'tv' ? Tv : Film;
  const ResultIcon = result ? RESULT_ICONS[result.tone] : null;
  const full = page.phone ? 'min-h-[44px] w-full' : 'h-8';

  const onVerb = () => {
    if (!folder.name && target === 'tv') page.openMainFolderTv();
    else void page.changeLayout(folder.name, target);
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col px-4 pb-4 pt-3.5">
      <SectionHeading id={headingId}>Layout</SectionHeading>
      <p className="mt-1 flex items-center gap-1.5 text-[13px]"><CurrentIcon size={14} aria-hidden="true" />Uses {layoutName(folder.layout)}</p>
      <p className="mt-2.5 text-xs text-muted-foreground">Preview as</p>
      <SegmentedControl<LibraryLayout>
        aria-label={`Preview ${folderLabel(folder.name, true)} as`}
        value={shown}
        size={page.phone ? 'lg' : 'md'}
        onChange={(value) => setPreview(value === folder.layout ? null : value)}
        options={[
          { value: 'videos', label: 'Videos', icon: <Film size={14} aria-hidden="true" />, hint: folder.layout === 'videos' ? 'current' : undefined },
          { value: 'tv', label: 'TV shows', icon: <Tv size={14} aria-hidden="true" />, hint: folder.layout === 'tv' ? 'current' : undefined },
        ]}
        className="mt-1"
      />
      <LayoutPreviewTree folder={folder} layout={shown} previewing={previewing} example={detail?.example ?? null} />
      {previewing && <AfterwardsNote folder={folder} target={target} />}
      <div className="mt-3 flex flex-col gap-2">
        <p id={consequenceId} className="text-[13px]">{consequence.text}</p>
        {!folder.name && target === 'tv' && (
          <p className="flex items-start gap-1.5 text-[13px] text-warning"><Warning size={15} aria-hidden="true" className="mt-0.5 shrink-0" />{MAIN_TV_WARNING}</p>
        )}
        <div className={cn('flex gap-2', page.phone && 'flex-col')}>
          <Button variant={previewing ? 'contained' : 'outlined'} disabled={consequence.blocked || busy}
            aria-describedby={consequence.blocked ? consequenceId : undefined} onClick={onVerb} className={full}
            startIcon={busy ? <CircularProgress size={14} /> : <TargetIcon size={14} aria-hidden="true" />}>
            {verbLabel(folder)}
          </Button>
          {previewing && <Button variant="text" onClick={() => setPreview(null)} className={full}>Keep {layoutName(folder.layout)}</Button>}
        </div>
        {result && ResultIcon && (
          <p role="status" className={cn('flex items-start gap-1.5 text-[13px]', RESULT_TONES[result.tone])}>
            <ResultIcon size={15} aria-hidden="true" className="mt-0.5 shrink-0" />{result.text}
          </p>
        )}
      </div>
    </section>
  );
}
