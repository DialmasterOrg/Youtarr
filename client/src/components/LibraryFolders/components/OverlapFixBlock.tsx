import React from 'react';
import { Button } from '../../ui';
import { cn } from '../../../lib/cn';
import type { LibraryCheckIssue, LibraryCheckServerReport } from '../../../types/libraryCheck';
import { ServerRef, folderState, needsLibrary } from '../../../utils/libraryAttention';
import { useLibraryPage } from '../LibraryFoldersContext';
import { countOf, folderLabel, followersLine, units } from '../folderText';
import { joinServerPath } from '../libraryTypes';
import { libraryTypeLabel } from '../mediaServerText';
import { ChannelLinks } from './ChannelLinks';
import { CopyButton } from './CopyButton';

/** What an edit does to the library's items, from the Phase 2 verification (Task 2.0, EDIT_NOTE). */
export const EDIT_NOTE = 'Their watch state stays.';

export interface OverlapFixBlockProps {
  issue: LibraryCheckIssue;
  server: ServerRef;
  report: LibraryCheckServerReport;
  downloadsPath: string | null;
}

/** The exact library edit for a nestedLibrary / overlap issue (UI 5.7.2.2). */
export function OverlapFixBlock({ issue, server, report, downloadsPath }: OverlapFixBlockProps) {
  const page = useLibraryPage();
  const main = page.folders.find((entry) => !entry.name) ?? null;
  const mainState = main ? folderState(main) : 'emptyMain';
  const { mainDetail } = page;
  const followers = mainDetail ? followersLine(mainDetail.followers, mainDetail.channels.length > 0) : null;
  const library = report.libraries.find((entry) => entry.id === issue.libraryId);
  const name = library?.name ?? `library ${issue.libraryId}`;
  const videoFolders = page.folders.filter((entry) => entry.name && entry.layout === 'videos' && needsLibrary(folderState(entry)));
  const mainUnit = units(main?.layout ?? 'videos');

  return (
    <div className="rounded-ui border border-border bg-card px-2.5 py-2 text-[13px]">
      <p className="font-semibold">Fix it in {server.name}</p>
      <ol className="mt-1 list-decimal space-y-1.5 pl-5">
        <li>Edit {name} ({libraryTypeLabel(server.serverType, library?.type ?? 'videos')} library) and remove its folder {library?.location ?? ''}.</li>
        {videoFolders.length > 0 && (
          <li>
            Add your Video folders to {name} instead:
            {downloadsPath ? (
              <ul className="mt-1 space-y-0.5">
                {videoFolders.map((entry) => {
                  const text = joinServerPath(downloadsPath, entry.name);
                  return (
                    <li key={entry.name} className="flex items-center gap-1 font-mono text-xs">
                      <span className="[overflow-wrap:anywhere]">{text}</span><CopyButton text={text} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <> {videoFolders.map((entry) => folderLabel(entry.name)).join(', ')} inside your downloads folder, as {server.name} sees it</>
            )}
          </li>
        )}
        {main && mainState === 'active' && main.channels > 0 && (
          <li>
            {countOf(main.channels, 'channel still downloads', 'channels still download')} straight into the main folder, which {name}{' '}
            would stop showing. Give each a Video folder first (Channel Settings &gt; Library folder moves its videos):{' '}
            <ChannelLinks channels={mainDetail?.channels ?? []} />
            {followers && <span className="mt-0.5 block">{followers}</span>}
          </li>
        )}
        {main && mainState === 'holdsVideos' && (
          <li>{countOf(main.fileCount ?? 0, mainUnit.one, mainUnit.many)} still sit in the main folder; {name} would stop showing them.</li>
        )}
        <li>
          Then check again.{' '}
          <Button variant="outlined" size="sm" onClick={() => { void page.check.refetch(); }}
            className={page.phone ? 'mt-1 min-h-[44px] w-full' : 'h-[30px]'}>
            Check again
          </Button>
        </li>
      </ol>
      <p className="mt-1.5 text-xs text-muted-foreground">{name} keeps its type, so editing its folders is enough. {EDIT_NOTE}</p>
      <button type="button" onClick={page.openStartTv} className={cn('mt-1 text-xs text-primary underline', page.phone && 'inline-flex min-h-[44px] items-center')}>See all your options</button>
    </div>
  );
}
