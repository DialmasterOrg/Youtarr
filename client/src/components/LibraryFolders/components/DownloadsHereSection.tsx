import React, { useId } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../../lib/cn';
import type { LibraryFolder, LibraryFolderDetail } from '../../../types/tvShows';
import { folderState } from '../../../utils/libraryAttention';
import { useLibraryPage } from '../LibraryFoldersContext';
import { countOf, folderLabel, formatCount, units } from '../folderText';
import { ChannelLinks } from './ChannelLinks';
import { SectionHeading } from './SectionHeading';

const ROUTING_NOTE = 'A channel picks its folder in Channel Settings > Library folder, a playlist in its own settings, and a '
  + 'single download in its download options. Channel settings come first, then playlist defaults; a folder chosen for one '
  + 'download overrides both.';
const FALLBACK = "Downloads with no more specific folder land here: videos from channels you don't subscribe to, unless a "
  + 'playlist or a single download picks another folder.';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const { phone } = useLibraryPage();
  return (
    <div className={cn('text-[13px]', phone ? 'flex flex-col gap-0.5' : 'grid grid-cols-[88px_1fr] gap-2.5')}>
      <span className={cn('text-muted-foreground', phone ? 'text-[11px] uppercase' : 'text-xs')}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

/** What downloads into the folder (UI 5.7.4). */
export function DownloadsHereSection({ folder, detail }: { folder: LibraryFolder; detail: LibraryFolderDetail | null }) {
  const page = useLibraryPage();
  const headingId = useId();
  const state = folderState(folder);
  const unit = units(folder.layout);
  const count = folder.fileCount ?? 0;
  const onDisk = count > 0 ? `${countOf(count, unit.one, unit.many)} on disk` : folder.hasFiles ? "Holds files Youtarr doesn't track" : 'Nothing on disk';
  const label = folderLabel(folder.name, true);
  const followers = detail?.followers ?? { count: 0, sample: [] };
  const chosen = detail?.channels ?? [];
  const inlineLink = cn('text-primary', page.phone && 'inline-flex min-h-[44px] items-center');

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1.5 px-4 pb-4 pt-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <SectionHeading id={headingId}>Downloads here</SectionHeading>
        <span className="text-xs text-muted-foreground">{onDisk}</span>
      </div>
      {state === 'holdsVideos' && (
        <p className="text-[13px]">
          Nothing downloads here now. {count > 0 ? `${countOf(count, unit.one, unit.many)} ${count === 1 ? 'is' : 'are'} on disk.` : "It holds files Youtarr doesn't track."}
        </p>
      )}
      {state === 'unused' && (
        <p className="flex flex-wrap items-center gap-2 text-[13px]">
          Nothing downloads here yet.
          <Link to="/subscriptions" className={cn('rounded-ui border border-primary px-2 text-primary', page.phone ? 'inline-flex min-h-[44px] items-center' : 'py-0.5')}>
            Choose channels for {label}
          </Link>
        </p>
      )}
      {chosen.length > 0 && (
        <Row label="Channels">
          <p className="font-semibold">{formatCount(chosen.length)} chose this folder</p>
          <ChannelLinks channels={chosen} unit={unit} />
        </Row>
      )}
      {folder.isDefault && followers.count > 0 && (
        <Row label={chosen.length > 0 ? '' : 'Channels'}>
          <p className="font-semibold">{formatCount(followers.count)} {followers.count === 1 ? 'follows' : 'follow'} the default</p>
          <p className="text-[12.5px] text-muted-foreground">
            Set to the default folder: {followers.sample.join(', ')}
            {followers.count > followers.sample.length ? ` and ${formatCount(followers.count - followers.sample.length)} more` : ''}
          </p>
        </Row>
      )}
      {(detail?.playlists.length ?? 0) > 0 && detail && (
        <Row label="Playlists">
          <p className="font-semibold">{formatCount(detail.playlists.length)} {detail.playlists.length === 1 ? 'uses it as its default' : 'use it as their default'}</p>
          <p>{detail.playlists.map((playlist, index) => (
            <span key={playlist.playlistId}>
              {index > 0 ? ', ' : ''}
              <Link to={`/playlist/${playlist.playlistId}`} className={inlineLink}>{playlist.name}</Link>
              <span className="text-xs text-muted-foreground"> {countOf(playlist.videoCount, unit.one, unit.many)}</span>
            </span>
          ))}</p>
          <p className="text-xs text-muted-foreground">A playlist&apos;s videos land here only when their channel has no folder of its own.</p>
        </Row>
      )}
      {(detail?.titleShows.length ?? 0) > 0 && detail && (
        <Row label="Title shows">
          {detail.titleShows.map((show) => (
            <p key={show.id}>
              <Link to={`/channel/${show.channelId}`} className={inlineLink}>{show.name}</Link>
              <span className="text-muted-foreground"> from {show.channelName}, {countOf(show.episodeCount, 'episode', 'episodes')} (Channel Settings &gt; TV Show)</span>
            </p>
          ))}
        </Row>
      )}
      {folder.isDefault && (
        <Row label="Fallback">
          <p>{FALLBACK}{folder.layout === 'tv' ? ' Each of those channels becomes its own show.' : ''}</p>
        </Row>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{ROUTING_NOTE}</p>
    </section>
  );
}
