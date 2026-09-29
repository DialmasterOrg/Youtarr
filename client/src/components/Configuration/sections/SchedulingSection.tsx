import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AccordionRoot, Alert, Typography } from '../../ui';
import { ConfigState, DeploymentEnvironment, PlatformManagedState } from '../types';
import { SCHEDULE_FIELDS, SCHEDULE_GROUPS, ScheduleFieldErrors, ScheduleKey } from '../schedules';
import { useScheduleStatus } from '../hooks/useScheduleStatus';
import { useRunScheduledTask } from '../hooks/useRunScheduledTask';
import { useNow } from '../hooks/useNow';
import { ScheduleTaskRow } from './components/ScheduleTaskRow';
import { ScheduleTaskDetails } from './components/ScheduleTaskDetails';
import { summarizeTasks } from './components/scheduleDisplay';

interface SchedulingSectionProps {
  config: ConfigState;
  // The last saved config, to mark schedules edited but not yet saved.
  savedConfig?: ConfigState | null;
  deploymentEnvironment: DeploymentEnvironment;
  isPlatformManaged: PlatformManagedState;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  fieldErrors: ScheduleFieldErrors;
  token: string | null;
}

const SCHEDULE_KEYS = new Set<string>(SCHEDULE_FIELDS.map((field) => field.key));
const SUMMARY_TONE_CLASSES = { running: 'text-primary', error: 'text-destructive' };

// Opens rows whose key newly appears in keys (a save error, a failed Run now),
// without reopening one the user has since collapsed.
function useOpenWhenFlagged(keys: string[], open: (keys: string[]) => void) {
  const seen = useRef<Set<string>>(new Set());
  const signature = keys.join(',');
  useEffect(() => {
    const current = signature ? signature.split(',') : [];
    const fresh = current.filter((key) => !seen.current.has(key));
    seen.current = new Set(current);
    open(fresh);
  }, [signature, open]);
}

// A schedule as a string; anything else (missing, hand-edited) reads as empty.
function scheduleValue(config: ConfigState | null | undefined, key: ScheduleKey): string {
  const value = config?.[key];
  return typeof value === 'string' ? value : '';
}

function flaggedKeys(record: Partial<Record<string, string>>): string[] {
  return Object.keys(record).filter((key) => Boolean(record[key])).sort();
}

export function SchedulingSection({
  config, savedConfig, deploymentEnvironment, isPlatformManaged, onConfigChange, fieldErrors, token,
}: SchedulingSectionProps) {
  const { hash } = useLocation();
  const { tasks, error: statusError, refresh, clockOffsetMs } = useScheduleStatus(token);
  const { pending: runPending, errors: runErrors, runTask } = useRunScheduledTask(token, refresh);
  const now = useNow() + clockOffsetMs;
  const statusByKey = useMemo(() => new Map(tasks.map((task) => [task.key, task])), [tasks]);
  const summary = useMemo(() => summarizeTasks(tasks, now), [tasks, now]);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const timeZone = deploymentEnvironment.timezone;

  const openRows = useCallback((keys: string[]) => {
    if (keys.length === 0) return;
    setOpenKeys((current) => (keys.every((key) => current.includes(key))
      ? current
      : Array.from(new Set([...current, ...keys]))));
  }, []);

  useOpenWhenFlagged(flaggedKeys(fieldErrors), openRows);
  useOpenWhenFlagged(flaggedKeys(runErrors), openRows);

  useEffect(() => {
    const key = hash.slice(1);
    if (!key) return;
    if (SCHEDULE_KEYS.has(key)) openRows([key]);
    document.getElementById(key)?.scrollIntoView?.({ block: 'start' });
  }, [hash, openRows]);

  return (
    <div>
      <Alert severity="info" className="mb-4">
        Times are in server time: <strong>{timeZone || 'server local time'}</strong>.
        <details className="mt-1">
          <summary className="cursor-pointer font-medium">How scheduling works</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li>Changes apply after saving.</li>
            <li>If a run is still in progress at its next scheduled time, that occurrence is skipped.</li>
            <li>Youtarr must be running at the scheduled time; missed runs are not replayed.</li>
            <li>Run now starts a task immediately with your saved settings.</li>
          </ul>
        </details>
      </Alert>
      {statusError && <Alert severity="warning" className="mb-4">{statusError}</Alert>}
      {summary.length > 0 && (
        <Typography variant="body2" color="text.secondary" aria-label="Schedule summary">
          {summary.map((part, index) => (
            <React.Fragment key={part.text}>
              {index > 0 && ' · '}
              <span className={part.tone ? SUMMARY_TONE_CLASSES[part.tone] : undefined}>{part.text}</span>
            </React.Fragment>
          ))}
        </Typography>
      )}

      {SCHEDULE_GROUPS.map((group) => (
        <div key={group.key} className="mt-6">
          <h2 className="mb-2 text-lg font-semibold">{group.title}</h2>
          <AccordionRoot
            type="multiple"
            value={openKeys}
            onValueChange={setOpenKeys}
            className="overflow-hidden rounded-[var(--radius-ui)] border border-[var(--border-strong)] bg-card"
          >
            {SCHEDULE_FIELDS.filter((field) => field.group === group.key).map((field) => {
              const managed = field.key === 'ytdlpUpdateFrequency' && isPlatformManaged.ytdlpUpdates;
              const featureOnInForm = field.enabledKey === null || Boolean(config[field.enabledKey]);
              const value = scheduleValue(config, field.key);
              const status = statusByKey.get(field.key);
              return (
                <ScheduleTaskRow
                  key={field.key}
                  field={field}
                  status={status}
                  value={value}
                  managed={managed}
                  edited={Boolean(savedConfig) && scheduleValue(savedConfig, field.key) !== value}
                  invalid={Boolean(fieldErrors[field.key]) || !value.trim()}
                  now={now}
                  pending={Boolean(runPending[field.key])}
                  onRun={() => runTask(field.key)}
                >
                  <ScheduleTaskDetails
                    field={field}
                    status={status}
                    value={value}
                    managed={managed}
                    featureOnInForm={featureOnInForm}
                    error={fieldErrors[field.key]}
                    runError={runErrors[field.key]}
                    timeZone={timeZone}
                    onChange={(next) => onConfigChange({ [field.key]: next })}
                  />
                </ScheduleTaskRow>
              );
            })}
          </AccordionRoot>
        </div>
      ))}
    </div>
  );
}
