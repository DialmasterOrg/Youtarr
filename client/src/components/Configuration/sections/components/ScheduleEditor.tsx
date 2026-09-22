import React, { useState } from 'react';
import { Alert, Button, FormControl, FormHelperText, InputLabel, MenuItem, Select, TextField } from '../../../ui';
import { FREQUENCY_MAPPING } from '../../constants';
import { describeSchedule, getDailyTime, isSupportedCronSyntax, MIN_SCHEDULE_INTERVAL_MINUTES } from '../../schedules';

type Mode = 'daily' | 'preset' | 'custom';

// Text inputs match the Select trigger height so paired controls stay level.
const INPUT_HEIGHT_CLASS = '[&_input]:min-h-[48px]';
const PRESETS = Object.entries(FREQUENCY_MAPPING);
const CRON_HELP = 'Minute · hour · day of month · month · day of week. Optional seconds may come first. '
  + `Runs must be at least ${MIN_SCHEDULE_INTERVAL_MINUTES} minutes apart.`;
const CRON_REFERENCE_URL = 'https://crontab.guru';

const isPreset = (expression: string): boolean => PRESETS.some(([, cron]) => cron === expression);
const inferMode = (expression: string): Mode => getDailyTime(expression) !== null
  ? 'daily' : isPreset(expression) ? 'preset' : 'custom';

interface ScheduleEditorProps {
  id: string;
  label: string;
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  // Advisory text shown beneath the controls; the caller decides when the
  // chosen schedule needs one. Never blocks saving.
  warning?: string | null;
}

export function ScheduleEditor({
  id, label, value, defaultValue, onChange, error, disabled = false, warning = null,
}: ScheduleEditorProps) {
  const [mode, setMode] = useState<Mode>(() => inferMode(value));
  const hasError = Boolean(error) || !value.trim();

  const changeMode = (next: Mode) => {
    setMode(next);
    if (next === 'daily' && getDailyTime(value) === null) {
      onChange(getDailyTime(defaultValue) !== null ? defaultValue : '0 0 * * *');
    } else if (next === 'preset' && !isPreset(value)) {
      onChange(isPreset(defaultValue) ? defaultValue : '0 * * * *');
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormControl fullWidth disabled={disabled}>
          <InputLabel id={`${id}-mode-label`}>Schedule type</InputLabel>
          <Select
            labelId={`${id}-mode-label`}
            disabled={disabled}
            value={mode}
            onChange={(event) => changeMode(event.target.value as Mode)}
          >
            <MenuItem value="daily">Daily</MenuItem>
            <MenuItem value="preset">Preset interval</MenuItem>
            <MenuItem value="custom">Custom cron</MenuItem>
          </Select>
        </FormControl>
        {mode === 'daily' && (
          <FormControl fullWidth disabled={disabled}>
            <InputLabel htmlFor={`${id}-time`} error={hasError}>Time (server timezone)</InputLabel>
            <TextField
              id={`${id}-time`}
              type="time"
              fullWidth
              className={INPUT_HEIGHT_CLASS}
              disabled={disabled}
              value={getDailyTime(value) ?? ''}
              error={hasError}
              onChange={(event) => {
                const [hour, minute] = event.target.value.split(':');
                onChange(hour && minute ? `${Number(minute)} ${Number(hour)} * * *` : '');
              }}
            />
            {hasError && <FormHelperText error>{error || 'Choose a time.'}</FormHelperText>}
          </FormControl>
        )}
        {mode === 'preset' && (
          <FormControl fullWidth disabled={disabled}>
            <InputLabel id={`${id}-interval-label`}>Interval</InputLabel>
            <Select
              labelId={`${id}-interval-label`}
              disabled={disabled}
              value={value}
              onChange={(event) => onChange(String(event.target.value))}
            >
              {PRESETS.map(([name, cron]) => <MenuItem key={name} value={cron}>{name}</MenuItem>)}
            </Select>
          </FormControl>
        )}
        {mode === 'custom' && (
          <FormControl fullWidth disabled={disabled}>
            <InputLabel htmlFor={`${id}-cron`} error={hasError}>Cron expression</InputLabel>
            <TextField
              id={`${id}-cron`}
              fullWidth
              className={INPUT_HEIGHT_CLASS}
              disabled={disabled}
              value={value}
              error={hasError}
              onChange={(event) => onChange(event.target.value)}
            />
            <FormHelperText error={hasError}>
              {error || (!value.trim() ? 'Enter a cron expression.' : (
                <>
                  {CRON_HELP}{' '}
                  <a href={CRON_REFERENCE_URL} target="_blank" rel="noreferrer" className="underline">crontab.guru</a>
                  {' '}can help.
                </>
              ))}
            </FormHelperText>
            {!error && isSupportedCronSyntax(value) && (
              <FormHelperText>Runs: {describeSchedule(value.trim())}</FormHelperText>
            )}
          </FormControl>
        )}
      </div>
      {warning && <Alert severity="warning">{warning}</Alert>}
      <Button
        variant="text"
        className="-ml-4"
        disabled={disabled}
        aria-label={`Restore default for ${label}`}
        onClick={() => { setMode(inferMode(defaultValue)); onChange(defaultValue); }}
      >
        Restore default
      </Button>
    </div>
  );
}
