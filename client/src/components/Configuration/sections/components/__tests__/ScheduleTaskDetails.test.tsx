import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../../test-utils';
import { ScheduleTaskDetails } from '../ScheduleTaskDetails';
import { SCHEDULE_FIELDS } from '../../../schedules';
import { ScheduleTaskStatus } from '../../../hooks/useScheduleStatus';

const field = SCHEDULE_FIELDS.find((candidate) => candidate.key === 'watchStatusSyncFrequency')!;

const status = (overrides: Partial<ScheduleTaskStatus> = {}): ScheduleTaskStatus => ({
  key: 'watchStatusSyncFrequency',
  label: 'Watch status sync',
  enabled: true,
  active: true,
  expression: '0 */4 * * *',
  error: null,
  running: false,
  nextRunAt: null,
  lastRun: null,
  runNow: { available: true, reason: null, message: null, availableAt: null },
  ...overrides,
});

const baseProps = {
  field,
  status: status(),
  value: '0 */4 * * *',
  managed: false,
  featureOnInForm: true,
  timeZone: 'UTC',
  onChange: jest.fn(),
};

test('describes the task and links to its settings', () => {
  renderWithProviders(<ScheduleTaskDetails {...baseProps} />);
  expect(screen.getByText(field.description)).toBeInTheDocument();
  expect(screen.getByText('Runs on this schedule.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Watch status settings' })).toHaveAttribute('href', '/settings/watch-status');
});

test('explains an idle schedule and links to where to turn it on', () => {
  renderWithProviders(<ScheduleTaskDetails {...baseProps} featureOnInForm={false} />);
  expect(screen.getByText(/Watch status sync is off, so this schedule is idle/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Turn on in Watch status settings' })).toBeInTheDocument();
});

test('explains why Run now is unavailable, with a link to fix it', () => {
  renderWithProviders(<ScheduleTaskDetails {...baseProps} status={status({
    runNow: { available: false, reason: 'downloads-paused', message: 'Downloads are paused.', availableAt: null },
  })} />);
  expect(screen.getByText(/Downloads are paused\./)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Storage limits' })).toHaveAttribute('href', '/settings/storage-limits');
});

test('shows a failed Run now request in an alert', () => {
  renderWithProviders(<ScheduleTaskDetails {...baseProps} runError="Could not start the task." />);
  expect(screen.getByRole('alert')).toHaveTextContent('Could not start the task.');
});

test('passes schedule edits to onChange', () => {
  const onChange = jest.fn();
  renderWithProviders(<ScheduleTaskDetails {...baseProps} value="0 4 * * *" onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('Time (server timezone)'), { target: { value: '05:30' } });
  expect(onChange).toHaveBeenCalledWith('30 5 * * *');
});

test('disables editing on a managed platform and says why', () => {
  renderWithProviders(<ScheduleTaskDetails {...baseProps} managed value="0 4 * * *" />);
  expect(screen.getByText('Updates are managed by your hosting platform.')).toBeInTheDocument();
  expect(screen.getByLabelText('Time (server timezone)')).toBeDisabled();
});
