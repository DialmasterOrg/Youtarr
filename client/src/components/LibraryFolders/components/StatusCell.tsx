import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle, Loader2, MinusCircle, Warning, XCircle } from '../../../lib/icons';
import { cn } from '../../../lib/cn';
import type { ServerDisplay, ServerStatus } from '../../../utils/libraryAttention';
import { statusDescription } from '../mediaServerText';

const HOLLOW_DOT = 'border-[1.5px] border-muted-foreground';

export const STATUS_TONE: Record<ServerDisplay, { text: string; border: string; dot: string; Icon: LucideIcon }> = {
  ok: { text: 'text-success', border: 'border-success', dot: 'bg-success', Icon: CheckCircle },
  issues: { text: 'text-warning', border: 'border-warning', dot: 'bg-warning', Icon: Warning },
  noLibrary: { text: 'text-destructive', border: 'border-destructive', dot: 'bg-destructive', Icon: XCircle },
  fine: { text: 'text-muted-foreground', border: 'border-border', dot: HOLLOW_DOT, Icon: MinusCircle },
  unchecked: { text: 'text-muted-foreground', border: 'border-border', dot: HOLLOW_DOT, Icon: Warning },
  checking: { text: 'text-muted-foreground', border: 'border-border', dot: HOLLOW_DOT, Icon: Loader2 },
};

/** A wide row's 120px status cell (UI 4.4). */
export function StatusCell({ status }: { status: ServerStatus }) {
  const tone = STATUS_TONE[status.display];
  const description = statusDescription(status);
  return (
    <span title={description} className={cn('inline-flex h-6 w-[120px] items-center gap-1 rounded-ui border px-1.5 text-xs', tone.text, tone.border)}>
      <tone.Icon size={13} aria-hidden="true" className={cn('shrink-0', status.display === 'checking' && 'animate-spin')} />
      <span aria-hidden="true" className="truncate">{status.word}</span>
      <span className="sr-only">{description}</span>
    </span>
  );
}

/** A stacked row's status line: a dot, the server and its word per server (UI 6.2). */
export function StatusLine({ statuses }: { statuses: ServerStatus[] }) {
  return (
    <span className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs">
      {statuses.map((status) => {
        const tone = STATUS_TONE[status.display];
        return (
          <span key={status.serverType} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('inline-block h-2 w-2 rounded-full', tone.dot)} />
            <span className="text-muted-foreground">{status.name}</span>
            <span className={tone.text}>{status.display === 'ok' ? 'OK' : status.word}</span>
          </span>
        );
      })}
    </span>
  );
}
