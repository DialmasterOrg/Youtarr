import React, { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Alert, Typography } from '../../ui';
import { ConfigurationCard } from '../common/ConfigurationCard';
import { ConfigState, DeploymentEnvironment, PlatformManagedState } from '../types';
import { getDefaultSchedule, runsMoreThanHourly, SCHEDULE_FIELDS, SCHEDULE_GROUPS, ScheduleFieldErrors } from '../schedules';
import { ScheduleTaskStatus, useScheduleStatus } from '../hooks/useScheduleStatus';
import { formatDateTimeInZone } from '../../../utils/formatters';
import { ScheduleEditor } from './components/ScheduleEditor';
import { ScheduleRunStatus } from './components/ScheduleRunStatus';

interface SchedulingSectionProps {
  config: ConfigState;
  deploymentEnvironment: DeploymentEnvironment;
  isPlatformManaged: PlatformManagedState;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  fieldErrors: ScheduleFieldErrors;
  token: string | null;
}

const MANAGED_TEXT = 'Updates are managed by your hosting platform.';
const ENABLED_TEXT = 'Runs on this schedule.';

function upcomingRuns(tasks: ScheduleTaskStatus[]): ScheduleTaskStatus[] {
  return tasks
    .filter((task) => task.active && task.nextRunAt)
    .sort((a, b) => (a.nextRunAt as string).localeCompare(b.nextRunAt as string));
}

export function SchedulingSection({
  config, deploymentEnvironment, isPlatformManaged, onConfigChange, fieldErrors, token,
}: SchedulingSectionProps) {
  const { hash } = useLocation();
  const { tasks, error: statusError } = useScheduleStatus(token);
  const statusByKey = useMemo(() => new Map(tasks.map((task) => [task.key, task])), [tasks]);
  const upcoming = useMemo(() => upcomingRuns(tasks), [tasks]);

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' });
  }, [hash]);

  return (
    <div>
      <Alert severity="info" className="mb-4">
        Schedules use server time: <strong>{deploymentEnvironment.timezone || 'server local time'}</strong>.
        {' '}Changes apply after saving. If a run is still in progress at its next scheduled time, that occurrence is skipped.
        {' '}Youtarr must be running at the scheduled time; missed runs are not replayed.
      </Alert>
      {statusError && <Alert severity="warning" className="mb-4">{statusError}</Alert>}

      <ConfigurationCard title="Upcoming runs" subtitle="The next occurrence of each active schedule, in server time.">
        {upcoming.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No tasks are currently scheduled.</Typography>
        ) : (
          <ul aria-label="Upcoming runs" className="m-0 list-none p-0 space-y-1 text-sm">
            {upcoming.map((task) => (
              <li key={task.key} className="flex flex-wrap justify-between gap-x-4">
                <span>{task.label}</span>
                <span className="text-muted-foreground">
                  {formatDateTimeInZone(task.nextRunAt, deploymentEnvironment.timezone)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ConfigurationCard>

      {SCHEDULE_GROUPS.map((group) => (
        <div key={group.key} className="mt-6">
          <h2 className="text-lg font-semibold mb-3">{group.title}</h2>
          {SCHEDULE_FIELDS.filter((field) => field.group === group.key).map((field) => {
            const managed = field.key === 'ytdlpUpdateFrequency' && isPlatformManaged.ytdlpUpdates;
            const enabled = field.enabledKey === null || Boolean(config[field.enabledKey]);
            const stateText = managed ? MANAGED_TEXT : enabled ? ENABLED_TEXT : field.disabledText;
            const linkText = !managed && !enabled ? `Turn on in ${field.settingsLabel}` : field.settingsLabel;
            const value = typeof config[field.key] === 'string' ? config[field.key] : '';
            const warning = field.frequentRunWarning && runsMoreThanHourly(value) ? field.frequentRunWarning : null;
            return (
              <section id={field.key} key={field.key} aria-label={field.label} className="scroll-mt-24 mb-4">
                <ConfigurationCard title={field.label} subtitle={field.description}>
                  <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
                    <Typography variant="body2" color="text.secondary">{stateText}</Typography>
                    <Link to={`/settings/${field.settingsPath}`} className="underline font-medium">{linkText}</Link>
                  </div>
                  <ScheduleRunStatus status={statusByKey.get(field.key)} timeZone={deploymentEnvironment.timezone} />
                  <ScheduleEditor
                    id={field.key}
                    label={field.label}
                    value={value}
                    defaultValue={getDefaultSchedule(field.key)}
                    onChange={(next) => onConfigChange({ [field.key]: next })}
                    error={fieldErrors[field.key]}
                    disabled={managed}
                    warning={warning}
                  />
                </ConfigurationCard>
              </section>
            );
          })}
        </div>
      ))}
    </div>
  );
}
