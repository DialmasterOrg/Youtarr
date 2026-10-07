import React from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Film, HelpCircle, Info, Tv } from '../../../lib/icons';
import { cn } from '../../../lib/cn';
import type { LibraryLayout } from '../../../types/tvShows';
import { useLibraryPage } from '../LibraryFoldersContext';
import { useGuideOpen } from '../hooks/useGuideOpen';
import { LIBRARY_TYPE_NAMES, SETUP_SERVER_NAMES, SetupServer } from '../libraryTypes';

const SUMMARY = 'Channels pick a folder, its layout files them, a matching library shows it.';
const STEPS = [
  { title: 'Channels pick a folder', text: 'In their settings, or the default folder' },
  { title: "The folder's layout files them", text: 'Videos or TV shows, set per folder' },
  { title: 'A matching library shows it', text: 'On each server, a library of the type the layout needs' },
];
const LAST = '\u2514\u2500 ';
const CARDS: Array<{ layout: LibraryLayout; title: string; subtitle: string; tree: string[]; phoneTree: string[] }> = [
  {
    layout: 'videos', title: 'Videos', subtitle: "Youtarr's existing movie-style layout",
    tree: ['__Kids/', `${LAST}Blippi/`, `   ${LAST}Blippi - Title - id/`, `      ${LAST}Blippi - Title [id].mp4`],
    phoneTree: ['__Kids/', `${LAST}Blippi/`, `   ${LAST}Blippi - Title - id/Blippi - Title [id].mp4`],
  },
  {
    layout: 'tv', title: 'TV shows', subtitle: 'Each channel a show, each upload year a season',
    tree: ['__TV Shows/', `${LAST}Veritasium/`, `   ${LAST}Season 2026/`, `      ${LAST}S2026E09281530 - Title [id].mp4`],
    phoneTree: ['__TV Shows/', `${LAST}Veritasium/Season 2026/`, `   ${LAST}S2026E09281530 - Title [id].mp4`],
  },
];
const ALL_SERVERS: SetupServer[] = ['plex', 'jellyfin', 'emby', 'kodi'];

/** How library folders work (UI 5.4, 6.2). */
export function LibraryGuide() {
  const page = useLibraryPage();
  const [open, toggle] = useGuideOpen(page.guideDefaultOpen);
  const servers: SetupServer[] = page.servers.length > 0 ? page.servers.map((server) => server.serverType) : ALL_SERVERS;

  return (
    <section aria-labelledby="guide-title" className="rounded-ui border border-border bg-card">
      <div className={cn('flex items-center gap-2 py-1.5 pl-3.5 pr-1.5', open && 'border-b border-border')}>
        <HelpCircle size={page.phone ? 18 : 16} aria-hidden="true" className="text-primary" />
        <h2 id="guide-title" className="font-display text-[15px] font-semibold">How library folders work</h2>
        {!open && !page.phone && <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{SUMMARY}</span>}
        {(open || page.phone) && <span className="flex-1" />}
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls="guide-body"
          className={cn('inline-flex items-center gap-1 text-[13px] text-primary', page.phone ? 'min-h-[48px]' : 'h-[30px]')}>
          {open ? 'Hide the guide' : 'Show the guide'}
          {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </button>
      </div>
      {page.phone && <p className="px-3.5 pb-2 text-[12.5px] text-muted-foreground">{SUMMARY}</p>}
      <div id="guide-body" hidden={!open} className="px-3.5 pb-3.5 pt-3">
        <ol className={cn('gap-2.5', page.phone ? 'flex flex-col' : 'grid grid-cols-[1fr_16px_1fr_16px_1fr] items-start')}>
          {STEPS.map((step, index) => (
            <React.Fragment key={step.title}>
              {index > 0 && !page.phone && <li aria-hidden="true" className="pt-1 text-muted-foreground/70"><ArrowRight size={16} /></li>}
              <li className="flex gap-2">
                <span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-ui border border-primary text-xs text-primary">{index + 1}</span>
                <span>
                  <span className="block text-[13px] font-semibold">{step.title}</span>
                  <span className="block text-xs text-muted-foreground">{step.text}</span>
                </span>
              </li>
            </React.Fragment>
          ))}
        </ol>
        <div className={cn('mt-3 grid gap-3', page.phone ? 'grid-cols-1' : 'grid-cols-2')}>
          {CARDS.map((card) => {
            const Icon = card.layout === 'tv' ? Tv : Film;
            return (
              <div key={card.layout} className="rounded-ui bg-background px-3 py-2.5">
                <p className="flex items-baseline gap-2">
                  <Icon size={16} aria-hidden="true" className="self-center" />
                  <span className="font-display text-sm font-semibold">{card.title}</span>
                  <span className="text-xs text-muted-foreground">{card.subtitle}</span>
                </p>
                <div className={cn('mt-1.5 gap-2', page.phone ? 'flex flex-col' : 'grid grid-cols-[1fr_140px]')}>
                  <pre aria-hidden="true" className="overflow-hidden whitespace-pre font-mono text-[10.5px] leading-4 text-muted-foreground">
                    {(page.phone ? card.phoneTree : card.tree).join('\n')}
                  </pre>
                  {page.phone ? (
                    <p className="text-xs text-muted-foreground">
                      Library type: {servers.map((server) => `${SETUP_SERVER_NAMES[server]} ${LIBRARY_TYPE_NAMES[server][card.layout]}`).join(', ')}
                    </p>
                  ) : (
                    <dl className="text-[12.5px]">
                      <dt className="text-[11px] uppercase text-muted-foreground">Library type</dt>
                      {servers.map((server) => (
                        <dd key={server}>
                          <span className="text-muted-foreground">{SETUP_SERVER_NAMES[server]}</span> <span>{LIBRARY_TYPE_NAMES[server][card.layout]}</span>
                        </dd>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2.5 flex items-start gap-1.5 text-[12.5px] text-muted-foreground">
          <Info size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>
            Videos is Youtarr&apos;s existing layout, and your folders keep their organization: TV shows is optional. One library on
            the whole downloads folder works while every folder uses Videos.{' '}
            <button type="button" onClick={page.openStartTv}
              className={cn('text-primary underline', page.phone && 'inline-flex min-h-[44px] items-center')}>
              Start using TV shows
            </button>
          </span>
        </p>
      </div>
    </section>
  );
}
