import React from 'react';
import { Info, Warning } from '../../../lib/icons';
import { cn } from '../../../lib/cn';

/** A note inside a setting row (Core 2.3). */
export function SettingNote({ tone, children }: { tone: 'info' | 'warning'; children: React.ReactNode }) {
  const Icon = tone === 'warning' ? Warning : Info;
  return (
    <p className="mt-2.5 flex items-start gap-2 text-[13px] leading-[19.5px]">
      <Icon size={16} aria-hidden="true" className={cn('mt-0.5 shrink-0', tone === 'warning' ? 'text-warning' : 'text-muted-foreground')} />
      <span className={tone === 'warning' ? 'text-warning' : 'text-muted-foreground'}>{children}</span>
    </p>
  );
}

export default SettingNote;
