import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, Server } from '../../../lib/icons';
import { Button, CircularProgress } from '../../ui';
import { cn } from '../../../lib/cn';
import { useNow } from '../../Configuration/hooks/useNow';
import { checkStatus } from '../../../utils/libraryAttention';
import { useLibraryPage } from '../LibraryFoldersContext';
import { SEP } from '../folderText';
import { checkStatusText } from '../mediaServerText';

/** Heading, downloads path, check status and the page actions (UI 5.1, 5.2, 6.2). */
export function PageHeader() {
  const page = useLibraryPage();
  const now = useNow();
  const path = page.config.youtubeOutputDirectory || 'Not set';
  const source = page.isPlatformManaged.youtubeOutputDirectory ? 'set by DATA_PATH' : 'set by YOUTUBE_OUTPUT_DIR';
  const status = checkStatus(page.check, page.configuredServers);
  const statusText = checkStatusText(status, page.servers, now, page.timeZone);
  const phoneLink = page.phone && 'inline-flex min-h-[44px] items-center';
  const checkButton = page.servers.length > 0 && (
    <Button variant="outlined" disabled={page.check.loading} onClick={() => { void page.check.refetch(); }}
      startIcon={page.check.loading ? <CircularProgress size={14} /> : <RefreshCw size={14} />} className="h-[34px]">
      {page.check.loading ? 'Checking...' : 'Check media servers'}
    </Button>
  );
  const addButton = (
    <Button variant="contained" startIcon={<Plus size={14} />} onClick={() => page.openAddFolder('videos')}
      className={page.phone ? 'min-h-[44px] w-full' : 'h-[34px]'}>
      Add folder
    </Button>
  );
  const serverStatus = !page.serversKnown ? null : page.servers.length === 0
    ? <>No media server connected. <Link to="/settings/plex" className={cn('text-primary underline', phoneLink)}>Connect one</Link></>
    : statusText;

  return (
    <header className="flex flex-col gap-1.5">
      <div className={cn('flex gap-2', page.phone ? 'flex-col' : 'flex-wrap items-center')}>
        <div className={cn('flex items-baseline gap-1.5 font-display font-semibold', page.phone ? 'text-[22px]' : 'text-xl')}>
          <Link to="/settings" className={cn('font-normal text-muted-foreground', page.phone && 'text-[13px]', phoneLink)}>Settings</Link>
          <span aria-hidden="true" className="text-muted-foreground/70">/</span>
          <h1 className="font-semibold">Library folders</h1>
        </div>
        {!page.phone && <span className="flex-1" />}
        {!page.phone && <span className="flex gap-2">{checkButton}{addButton}</span>}
      </div>
      <div className={cn('flex gap-x-3 gap-y-1 text-[13px] text-muted-foreground', page.phone ? 'flex-col' : 'flex-wrap items-center')}>
        <span>
          {page.phone ? null : 'Downloads folder '}
          <code className="rounded-ui bg-muted px-1 font-mono text-xs text-foreground">{path}</code>{' '}
          {page.phone ? `downloads folder, ${source}` : source}
          {page.phone ? null : <>{SEP}Changes on this page save right away.</>}
        </span>
        {page.phone && <span>Changes on this page save right away.</span>}
        {!page.phone && <span className="flex-1" />}
        {serverStatus && <span className="inline-flex items-center gap-1.5"><Server size={14} aria-hidden="true" />{serverStatus}</span>}
      </div>
      {page.phone && <div className="mt-1.5">{addButton}</div>}
    </header>
  );
}
