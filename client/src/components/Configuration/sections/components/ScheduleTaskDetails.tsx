import React from 'react';
import { Link } from 'react-router-dom';
import { Typography } from '../../../ui';
import { getDefaultSchedule, runsMoreThanHourly, ScheduleField } from '../../schedules';
import { ScheduleTaskStatus } from '../../hooks/useScheduleStatus';
import { ScheduleEditor } from './ScheduleEditor';
import { ScheduleRunStatus } from './ScheduleRunStatus';
import { describeRunNowBlock } from './runNowHint';

const MANAGED_TEXT = 'Updates are managed by your hosting platform.';
const ENABLED_TEXT = 'Runs on this schedule.';

interface ScheduleTaskDetailsProps {
  field: ScheduleField;
  status: ScheduleTaskStatus | undefined;
  value: string;
  managed: boolean;
  featureOnInForm: boolean;
  error?: string;
  runError?: string;
  timeZone?: string | null;
  onChange: (value: string) => void;
}

// The expanded body of a task row: what the task does and where it is turned
// on, its full run history line, why Run now is unavailable, and the editor.
export function ScheduleTaskDetails({
  field, status, value, managed, featureOnInForm, error, runError, timeZone, onChange,
}: ScheduleTaskDetailsProps) {
  const stateText = managed ? MANAGED_TEXT : featureOnInForm ? ENABLED_TEXT : field.disabledText;
  const linkText = !managed && !featureOnInForm ? `Turn on in ${field.settingsLabel}` : field.settingsLabel;
  const warning = field.frequentRunWarning && runsMoreThanHourly(value) ? field.frequentRunWarning : null;
  const hint = status && !managed
    ? describeRunNowBlock({ availability: status.runNow, settingsLabel: field.settingsLabel, featureOnInForm, timeZone })
    : null;

  return (
    <div className="space-y-3 px-3 pt-1 sm:px-4 sm:pl-16">
      <div className="space-y-1">
        <Typography variant="body2">{field.description}</Typography>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Typography variant="body2" color="text.secondary">{stateText}</Typography>
          <Link to={`/settings/${field.settingsPath}`} className="underline font-medium">{linkText}</Link>
        </div>
      </div>
      <ScheduleRunStatus status={status} timeZone={timeZone} />
      {hint && (
        <Typography variant="body2" color="text.secondary">
          {hint.text}
          {hint.link && (
            <>
              {' '}
              <Link to={hint.link.to} className="underline font-medium">{hint.link.label}</Link>
            </>
          )}
        </Typography>
      )}
      {runError && <Typography variant="body2" role="alert" className="text-destructive">{runError}</Typography>}
      <ScheduleEditor
        id={field.key}
        label={field.label}
        value={value}
        defaultValue={getDefaultSchedule(field.key)}
        onChange={onChange}
        error={error}
        disabled={managed}
        warning={warning}
      />
    </div>
  );
}
