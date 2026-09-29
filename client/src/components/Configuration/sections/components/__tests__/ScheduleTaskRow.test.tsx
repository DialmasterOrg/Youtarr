import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../../../../test-utils';
import { AccordionRoot } from '../../../../ui';
import { ScheduleTaskRow } from '../ScheduleTaskRow';
import { SCHEDULE_FIELDS } from '../../../schedules';
import { ScheduleTaskStatus } from '../../../hooks/useScheduleStatus';

const NOW = Date.parse('2026-09-28T12:00:00.000Z');
const MINUTE = 60_000;
const field = SCHEDULE_FIELDS.find((candidate) => candidate.key === 'watchStatusSyncFrequency')!;

const status = (overrides: Partial<ScheduleTaskStatus> = {}): ScheduleTaskStatus => ({
  key: 'watchStatusSyncFrequency',
  label: 'Watch status sync',
  enabled: true,
  active: true,
  expression: '0 */4 * * *',
  error: null,
  running: false,
  nextRunAt: new Date(NOW + 90 * MINUTE).toISOString(),
  lastRun: {
    id: 1, taskKey: 'watchStatusSyncFrequency', trigger: 'scheduled', status: 'error', outcome: 'error',
    message: 'Server unreachable', details: null,
    startedAt: new Date(NOW - 35 * MINUTE).toISOString(), finishedAt: null,
  },
  runNow: { available: true, reason: null, message: null, availableAt: null },
  ...overrides,
});

const baseProps = {
  field,
  status: status(),
  value: '0 */4 * * *',
  managed: false,
  edited: false,
  invalid: false,
  now: NOW,
  pending: false,
  onRun: jest.fn(),
};

function renderRow(props: Partial<React.ComponentProps<typeof ScheduleTaskRow>> = {}) {
  return renderWithProviders(
    <AccordionRoot type="multiple">
      <ScheduleTaskRow {...baseProps} {...props}>
        <p>Task details</p>
      </ScheduleTaskRow>
    </AccordionRoot>
  );
}

const row = () => within(screen.getByRole('region', { name: 'Watch status sync' }));

beforeEach(() => {
  jest.clearAllMocks();
});

test('shows the schedule in words with the next and last run in the header', () => {
  renderRow();
  const header = row().getByRole('button', { name: /^Watch status sync/ });
  expect(header).toHaveTextContent('Every 4 hours');
  expect(header).toHaveTextContent('Next in 1h 30m');
  expect(header).toHaveTextContent('Failed 35m ago');
});

test('starts collapsed and expands when the header is clicked', () => {
  renderRow();
  const header = row().getByRole('button', { name: /^Watch status sync/ });
  expect(header).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(header);
  expect(header).toHaveAttribute('aria-expanded', 'true');
});

test('Run now starts the task without toggling the row', () => {
  const onRun = jest.fn();
  renderRow({ onRun });
  fireEvent.click(row().getByRole('button', { name: 'Run Watch status sync now' }));
  expect(onRun).toHaveBeenCalledTimes(1);
  expect(row().getByRole('button', { name: /^Watch status sync/ })).toHaveAttribute('aria-expanded', 'false');
});

test('labels a running task', () => {
  renderRow({ status: status({ running: true }) });
  expect(row().getByText('Running')).toBeInTheDocument();
  expect(row().getByTestId('task-status-dot')).toHaveAttribute('data-tone', 'running');
});

test('labels a task that is turned off', () => {
  renderRow({ status: status({ active: false, nextRunAt: null, lastRun: null }) });
  expect(row().getByText('Off')).toBeInTheDocument();
  expect(row().getByText('No upcoming run')).toBeInTheDocument();
});

test('marks an unsaved schedule change and describes the edited value', () => {
  renderRow({ edited: true, value: '0 3 * * *' });
  expect(row().getByText('Unsaved')).toBeInTheDocument();
  expect(row().getByText('Daily at 03:00')).toBeInTheDocument();
});

test('marks an invalid schedule instead of an unsaved one', () => {
  renderRow({ edited: true, invalid: true });
  expect(row().getByText('Invalid schedule')).toBeInTheDocument();
  expect(row().queryByText('Unsaved')).not.toBeInTheDocument();
});

test('says briefly why Run now is unavailable', () => {
  renderRow({ status: status({
    runNow: { available: false, reason: 'no-media-server', message: 'No media server.', availableAt: null },
  }) });
  expect(row().getByText('Run now unavailable: no media server')).toBeInTheDocument();
  expect(row().getByRole('button', { name: 'Run Watch status sync now' })).toBeDisabled();
});

test('has no Run now button for a platform-managed task', () => {
  renderRow({ managed: true });
  expect(row().queryByRole('button', { name: 'Run Watch status sync now' })).not.toBeInTheDocument();
  expect(row().getByText('Managed')).toBeInTheDocument();
});

test('shows only the schedule until the status loads', () => {
  renderRow({ status: undefined });
  expect(row().getByText('Every 4 hours')).toBeInTheDocument();
  expect(row().queryByText(/Next in/)).not.toBeInTheDocument();
  expect(row().queryByRole('button', { name: 'Run Watch status sync now' })).not.toBeInTheDocument();
});

test('says how long the last finished run took', () => {
  const finished = {
    id: 2, taskKey: 'watchStatusSyncFrequency', trigger: 'scheduled' as const, status: 'success' as const,
    outcome: 'completed', message: null, details: null,
    startedAt: new Date(NOW - 35 * MINUTE).toISOString(), finishedAt: new Date(NOW - 35 * MINUTE + 134_000).toISOString(),
  };
  renderRow({ status: status({ lastRun: finished, lastFinishedRun: finished }) });
  expect(row().getByRole('button', { name: /^Watch status sync/ })).toHaveTextContent('Ran 35m ago · took 2m 14s');
});

test('says a run cut off by a restart ended that way instead of giving a length', () => {
  const interrupted = {
    id: 3, taskKey: 'watchStatusSyncFrequency', trigger: 'scheduled' as const, status: 'interrupted' as const,
    outcome: null, message: 'The server restarted before it finished.', details: null,
    startedAt: new Date(NOW - 35 * MINUTE).toISOString(), finishedAt: null,
  };
  const finished = { ...interrupted, id: 2, status: 'success' as const, finishedAt: new Date(NOW - 30 * MINUTE).toISOString() };
  renderRow({ status: status({ lastRun: interrupted, lastFinishedRun: finished }) });
  const header = row().getByRole('button', { name: /^Watch status sync/ });
  expect(header).toHaveTextContent('Interrupted 35m ago · by a server restart');
  expect(header).not.toHaveTextContent('took');
});
