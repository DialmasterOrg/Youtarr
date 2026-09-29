import React from 'react';
import { AccordionContent, AccordionItem, AccordionTrigger } from '../../../ui';
import { ChevronRight } from '../../../../lib/icons';
import { describeSchedule, ScheduleField } from '../../schedules';
import { ScheduleTaskStatus } from '../../hooks/useScheduleStatus';
import { RunNowControl } from './RunNowControl';
import {
  describeLastRunBrief, describeNextRun, describeRunDurationBrief, describeRunNowBlockBrief, describeTaskState, TaskTone,
} from './scheduleDisplay';

const DOT_CLASSES: Record<TaskTone, string> = {
  running: 'bg-primary',
  error: 'bg-destructive',
  warning: 'bg-warning',
  ok: 'bg-success',
  off: 'border border-muted-foreground',
  unknown: 'bg-muted-foreground/30',
};

const TAG_CLASSES: Record<TaskTone, string> = {
  running: 'border-primary/40 bg-primary/10 text-primary',
  error: 'border-destructive/40 bg-destructive/10 text-destructive',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  ok: 'border-border bg-muted/40 text-muted-foreground',
  off: 'border-border bg-muted/40 text-muted-foreground',
  unknown: 'border-border bg-muted/40 text-muted-foreground',
};

const LAST_RUN_TEXT_CLASSES: Record<TaskTone, string> = {
  running: 'text-primary',
  error: 'text-destructive',
  warning: 'text-warning',
  ok: '',
  off: '',
  unknown: '',
};

function StatusDot({ tone }: { tone: TaskTone }) {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true" data-testid="task-status-dot" data-tone={tone}>
      {tone === 'running' && (
        <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping-slow motion-reduce:animate-none" />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${DOT_CLASSES[tone]}`} />
    </span>
  );
}

function StatusTag({ tone, children }: { tone: TaskTone; children: React.ReactNode }) {
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none ${TAG_CLASSES[tone]}`}>
      {children}
    </span>
  );
}

function Separator() {
  return <span aria-hidden="true" className="lg:hidden">·</span>;
}

interface ScheduleTaskRowProps {
  field: ScheduleField;
  status: ScheduleTaskStatus | undefined;
  // The schedule as currently entered, which may not be saved yet.
  value: string;
  managed: boolean;
  edited: boolean;
  invalid: boolean;
  now: number;
  pending: boolean;
  onRun: () => void;
  children: React.ReactNode;
}

// One task in the Scheduling list: a collapsed header that reads at a glance
// (status, schedule, next and last run, Run now) over expandable details.
// Phones get two lines; wide screens line the times up in columns.
export function ScheduleTaskRow({
  field, status, value, managed, edited, invalid, now, pending, onRun, children,
}: ScheduleTaskRowProps) {
  const state = describeTaskState(status, managed);
  const schedule = describeSchedule(value);
  const next = describeNextRun(status, now);
  const last = status ? describeLastRunBrief(status.lastRun, now) : null;
  const blocked = managed ? null : describeRunNowBlockBrief(status);
  const duration = describeRunDurationBrief(status);

  return (
    <AccordionItem value={field.key} asChild>
      <section id={field.key} aria-label={field.label} className="scroll-mt-24">
        <div className="flex items-center gap-2 pr-3 transition-colors hover:bg-muted/30 sm:gap-3 sm:pr-4">
          <div className="min-w-0 flex-1">
            <AccordionTrigger hideChevron className="group gap-3 py-3 pl-3 text-left hover:text-foreground sm:pl-4">
              <ChevronRight
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90"
              />
              <StatusDot tone={state.tone} />
              <span className="grid min-w-0 flex-1 gap-1 lg:grid-cols-[minmax(0,1fr)_12rem_10rem_11rem] lg:items-center lg:gap-x-4">
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{field.label}</span>
                  {state.label && <StatusTag tone={state.tone}>{state.label}</StatusTag>}
                  {invalid && <StatusTag tone="error">Invalid schedule</StatusTag>}
                  {!invalid && edited && <StatusTag tone="off">Unsaved</StatusTag>}
                </span>
                <span className="flex flex-wrap gap-x-1.5 text-xs font-normal text-muted-foreground lg:contents lg:text-sm">
                  <span className="lg:truncate" title={schedule}>{schedule}</span>
                  {status && (
                    <>
                      <Separator />
                      <span>{next}</span>
                      <Separator />
                      <span className="lg:flex lg:flex-col">
                        <span className={last ? LAST_RUN_TEXT_CLASSES[last.tone] : ''}>{last?.text}</span>
                        {duration && (
                          <span className="lg:text-xs">
                            <span aria-hidden="true" className="lg:hidden"> · </span>
                            {duration}
                          </span>
                        )}
                      </span>
                    </>
                  )}
                  {blocked && (
                    <>
                      <Separator />
                      <span className="lg:col-span-4 lg:text-xs">{blocked}</span>
                    </>
                  )}
                </span>
              </span>
            </AccordionTrigger>
          </div>
          <div className="flex w-9 shrink-0 justify-end sm:w-28">
            {!managed && <RunNowControl field={field} status={status} pending={pending} onRun={onRun} />}
          </div>
        </div>
        <AccordionContent>{children}</AccordionContent>
      </section>
    </AccordionItem>
  );
}
