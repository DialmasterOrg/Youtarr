import React from 'react';
import { cn } from '../../../lib/cn';
import { useContainerWidth } from '../../../hooks/useContainerWidth';

const TWO_COLUMN_MIN_WIDTH = 720;

export interface SettingsSectionProps {
  /** Anchor id; also prefixes the heading id */
  id: string;
  title: string;
  description?: React.ReactNode;
  /** Extra content under the description (chips, notes) */
  aside?: React.ReactNode;
  children: React.ReactNode;
}

/** A settings group: title and description beside (or above) a card of rows (Core 2.1). */
export function SettingsSection({ id, title, description, aside, children }: SettingsSectionProps) {
  const [measureRef, width] = useContainerWidth<HTMLDivElement>();
  const columns = width !== null && width >= TWO_COLUMN_MIN_WIDTH;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <div ref={measureRef} data-testid={`settings-section-${id}`} data-layout={columns ? 'columns' : 'stacked'}
        className={cn(columns ? 'grid grid-cols-[240px_minmax(0,1fr)] items-start gap-10' : 'flex flex-col gap-2.5')}>
        <div>
          <h2 id={`${id}-title`} className="font-display text-base font-semibold leading-[22px]">{title}</h2>
          {description && <p className="mt-1 text-[13px] leading-[19.5px] text-muted-foreground">{description}</p>}
          {aside && <div className="mt-2.5">{aside}</div>}
        </div>
        <div className="divide-y divide-border/60 rounded-ui border border-border bg-card">{children}</div>
      </div>
    </section>
  );
}

export default SettingsSection;
