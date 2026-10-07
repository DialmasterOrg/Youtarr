import React from 'react';
import { ChevronRight, RefreshCw, Warning } from '../../../lib/icons';
import { CircularProgress } from '../../ui';
import { useNow } from '../../Configuration/hooks/useNow';
import { AttentionItem, checkStatus } from '../../../utils/libraryAttention';
import { useLibraryPage } from '../LibraryFoldersContext';
import { checkStatusText } from '../mediaServerText';

/** Needs attention: library-wide items first, then folders (UI 4.5, 5.5, 6.2). */
export function AttentionStrip({ items }: { items: AttentionItem[] }) {
  const page = useLibraryPage();
  const now = useNow();
  if (items.length === 0) return null;
  const jump = (item: AttentionItem) => (item.kind === 'library' ? page.jumpTo(item.folders[0], item.serverType) : page.jumpTo(item.folder));

  if (page.phone) {
    const status = checkStatusText(checkStatus(page.check, page.configuredServers), page.servers, now, page.timeZone);
    return (
      <section aria-label="Needs attention" className="rounded-ui border border-warning bg-card">
        <div className="flex items-center gap-2.5 p-3">
          <Warning size={18} aria-hidden="true" className="text-warning" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-warning">Needs attention</p>
            <p className="text-xs text-muted-foreground">{status}</p>
          </div>
          <button type="button" aria-label="Check media servers again" onClick={() => { void page.check.refetch(); }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-ui text-muted-foreground">
            {page.check.loading ? <CircularProgress size={16} /> : <RefreshCw size={18} aria-hidden="true" />}
          </button>
        </div>
        {items.map((item) => (
          <button key={item.key} type="button" onClick={() => jump(item)}
            className="flex min-h-[44px] w-full items-center gap-2 border-t border-border py-2 pl-10 pr-3 text-left text-[13px] font-medium text-primary">
            <span className="min-w-0 flex-1">{item.text}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ))}
      </section>
    );
  }

  return (
    <div role="status" className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 rounded-ui border border-warning bg-card px-3 py-[9px] text-[13px]">
      <span className="inline-flex items-center gap-1.5 font-semibold text-warning">
        <Warning size={15} aria-hidden="true" />Needs attention:
      </span>
      {items.map((item, index) => (
        <span key={item.key}>
          <button type="button" onClick={() => jump(item)} className="text-primary underline">{item.text}</button>
          {index < items.length - 1 ? ',' : ''}
        </span>
      ))}
    </div>
  );
}
