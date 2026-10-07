import React from 'react';
import { Link } from 'react-router-dom';
import { Library } from '../../../lib/icons';
import { cn } from '../../../lib/cn';
import { DEFAULT_CONFIG } from '../../../config/configSchema';
import type { LibraryFolder, LibraryFolderDetail, LibraryLayout } from '../../../types/tvShows';
import { useLibraryPage } from '../LibraryFoldersContext';
import { exampleFrom, previewRows, readsAs } from '../layoutPreview';

const NOTE_OWN_LINE_AFTER = 26;
const trimEnd = (value: string | null | undefined) => (value ?? '').replace(/\s+$/, '');

/** The layout preview: an example tree, labelled as an example (UI 5.7.3). */
export function LayoutPreviewTree({ folder, layout, previewing, example }: {
  folder: LibraryFolder; layout: LibraryLayout; previewing: boolean; example: LibraryFolderDetail['example'];
}) {
  const { config, phone } = useLibraryPage();
  const sample = exampleFrom(example);
  const baseName = (config.youtubeOutputDirectory || '').split(/[\\/]/).filter(Boolean).pop() || 'data';
  const rows = previewRows({
    folderName: folder.name, baseName, layout, currentLayout: folder.layout, example: sample, flat: Boolean(config.defaultSkipVideoFolder),
  });
  const customTemplate = trimEnd(config.videoFilenamePrefix) !== trimEnd(DEFAULT_CONFIG.videoFilenamePrefix);
  return (
    <div className="mt-2.5 rounded-ui border border-border bg-background">
      <p className="border-b border-border px-2.5 py-1.5 text-xs">
        Example structure, with {sample.channelName}
        {previewing && <span className="text-primary"> (preview, not applied)</span>}
      </p>
      <ul aria-label="Example file structure" className={cn('flex flex-col gap-0.5 px-2.5 py-2 font-mono leading-[1.45]', phone ? 'text-[11px]' : 'text-[11.5px]')}>
        {rows.map((row, index) => (
          <li key={`${index}:${row.name}`} className={cn('flex flex-wrap items-baseline gap-x-2',
            row.kind === 'file' ? 'text-muted-foreground' : 'text-foreground', row.kind === 'media' && 'font-medium')}>
            <span className="whitespace-pre [overflow-wrap:anywhere]">{row.prefix}{row.name}</span>
            {row.note && (
              <span className={cn('font-sans text-[11px] font-normal text-muted-foreground', row.name.length > NOTE_OWN_LINE_AFTER && 'basis-full pl-[3ch]')}>
                {row.note}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="px-2.5 pb-2 text-xs text-muted-foreground">
        Example structure. Review the move for exact file names.
        {layout === 'videos' && previewing && customTemplate ? ' Your filename template decides the real names.' : ''}
      </p>
      <p className="flex items-start gap-1.5 border-t border-border px-2.5 py-2 text-[12.5px]">
        <Library size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>
          {readsAs(layout, sample)}
          {layout === 'videos' && (
            <> <Link to="/settings/core#naming" className={cn('text-primary underline', phone && 'inline-flex min-h-[44px] items-center')}>
              Filename template: Settings &gt; Core
            </Link></>
          )}
        </span>
      </p>
    </div>
  );
}
