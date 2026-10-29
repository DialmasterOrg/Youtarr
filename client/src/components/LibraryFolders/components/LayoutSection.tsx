import React, { useEffect, useId, useState } from 'react';
import { Film, Info, CheckCircle, Tv, Warning } from '../../../lib/icons';
import { Button, CircularProgress, SegmentedControl } from '../../ui';
import { cn } from '../../../lib/cn';
import type { LibraryFolder, LibraryFolderDetail, LibraryLayout } from '../../../types/tvShows';
import { folderKey } from '../../../utils/libraryLayouts';
import { useLibraryPage } from '../LibraryFoldersContext';
import { folderLabel, layoutConsequence, layoutName, otherLayout, SEP, verbLabel } from '../folderText';
import { exampleFrom, readsAs } from '../layoutPreview';
import { AfterwardsNote } from './AfterwardsNote';
import { LayoutPreviewTree } from './LayoutPreviewTree';
import { SectionHeading } from './SectionHeading';

const MAIN_TV_WARNING = 'Youtarr writes a .plexignore here so a Plex TV library skips your __subfolders. Jellyfin and Emby '
  + "can't skip them and would show each __subfolder as an extra show.";
const LAYOUT_SUMMARY: Record<LibraryLayout, string> = {
  videos: "each video a movie in its channel's folder",
  tv: 'each channel a show, each upload year a season',
};
const RESULT_ICONS = { success: CheckCircle, warning: Warning, info: Info };
const RESULT_TONES = { success: 'text-success', warning: 'text-warning', info: 'text-info' };

/**
 * Layout: one line saying how the folder shows up, until Change... opens Preview as, the example tree, the afterwards
 * note and the change itself (UI 5.7.3). Changing a layout is rare, so its preview waits to be asked for.
 */
export function LayoutSection({ folder, detail }: { folder: LibraryFolder; detail: LibraryFolderDetail | null }) {
  const page = useLibraryPage();
  const headingId = useId();
  const consequenceId = useId();
  const target = otherLayout(folder.layout);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<LibraryLayout>(target);
  useEffect(() => {
    setOpen(false);
    setPreview(otherLayout(folder.layout));
  }, [folder.name, folder.layout]);
  const previewing = preview === target;
  const consequence = layoutConsequence({ folder, titleShows: detail?.titleShows ?? null, reorganizing: page.reorganizing });
  const busy = page.busyLayoutFolder !== null && folderKey(page.busyLayoutFolder) === folderKey(folder.name);
  // A change that is running stays in view until it settles.
  const expanded = open || busy;
  const result = page.layoutResult && folderKey(page.layoutResult.folder) === folderKey(folder.name) ? page.layoutResult : null;
  const CurrentIcon = folder.layout === 'tv' ? Tv : Film;
  const TargetIcon = target === 'tv' ? Tv : Film;
  const ResultIcon = result ? RESULT_ICONS[result.tone] : null;
  const full = page.phone ? 'min-h-[44px] w-full' : 'h-8';

  const onVerb = () => {
    if (!folder.name && target === 'tv') page.openMainFolderTv();
    else void page.changeLayout(folder.name, target);
  };
  const close = () => {
    setOpen(false);
    setPreview(target);
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1 px-4 pb-4 pt-3.5">
      <div className="flex items-center gap-2">
        <SectionHeading id={headingId}>Layout</SectionHeading>
        <span className="flex-1" />
        {!expanded && (
          <Button variant="outlined" size="sm" onClick={() => setOpen(true)} className={page.phone ? 'min-h-[44px]' : 'h-[28px]'}>
            Change...
          </Button>
        )}
      </div>
      <p className="text-[13px]">
        <CurrentIcon size={14} aria-hidden="true" className="mr-1.5 inline-block align-[-2px]" />
        <span className="font-semibold">{layoutName(folder.layout)}</span>
        <span className="text-muted-foreground">{`${SEP}${LAYOUT_SUMMARY[folder.layout]}`}</span>
      </p>
      {!expanded && (
        <p className="line-clamp-2 text-[12.5px] text-muted-foreground">{readsAs(folder.layout, exampleFrom(detail?.example ?? null), folder.layout)}</p>
      )}
      {expanded && (
        <div className="mt-1.5 flex flex-col">
          <p className="text-xs text-muted-foreground">Preview as</p>
          <SegmentedControl<LibraryLayout>
            aria-label={`Preview ${folderLabel(folder.name, true)} as`}
            value={preview}
            size={page.phone ? 'lg' : 'md'}
            onChange={setPreview}
            options={[
              { value: 'videos', label: 'Videos', icon: <Film size={14} aria-hidden="true" />, hint: folder.layout === 'videos' ? 'current' : undefined },
              { value: 'tv', label: 'TV shows', icon: <Tv size={14} aria-hidden="true" />, hint: folder.layout === 'tv' ? 'current' : undefined },
            ]}
            className="mt-1"
          />
          <LayoutPreviewTree folder={folder} layout={preview} previewing={previewing} example={detail?.example ?? null} />
          {previewing && <AfterwardsNote folder={folder} target={target} />}
          <div className="mt-3 flex flex-col gap-2">
            <p id={consequenceId} className={cn('flex items-start gap-1.5 text-[13px]', consequence.blocked && 'text-warning')}>
              {consequence.blocked && <Warning size={15} aria-hidden="true" className="mt-0.5 shrink-0" />}{consequence.text}
            </p>
            {!folder.name && target === 'tv' && (
              <p className="flex items-start gap-1.5 text-[13px] text-warning"><Warning size={15} aria-hidden="true" className="mt-0.5 shrink-0" />{MAIN_TV_WARNING}</p>
            )}
            <div className={cn('flex gap-2', page.phone && 'flex-col')}>
              <Button variant={previewing ? 'contained' : 'outlined'} disabled={consequence.blocked || busy}
                aria-describedby={consequence.blocked ? consequenceId : undefined} onClick={onVerb} className={full}
                startIcon={busy ? <CircularProgress size={14} /> : <TargetIcon size={14} aria-hidden="true" />}>
                {verbLabel(folder)}
              </Button>
              <Button variant="text" onClick={close} disabled={busy} className={full}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
      {result && ResultIcon && (
        <p role="status" className={cn('mt-1 flex items-start gap-1.5 text-[13px]', RESULT_TONES[result.tone])}>
          <ResultIcon size={15} aria-hidden="true" className="mt-0.5 shrink-0" />{result.text}
        </p>
      )}
    </section>
  );
}
