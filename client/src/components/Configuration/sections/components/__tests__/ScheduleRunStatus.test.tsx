import React from 'react';
import { render, screen } from '@testing-library/react';
import { formatDateTime, formatDateTimeInZone } from '../../../../../utils/formatters';
import { ScheduleRunStatus } from '../ScheduleRunStatus';
import { ScheduleTaskStatus } from '../../../hooks/useScheduleStatus';

const base: ScheduleTaskStatus = {
  key: 'autoRemovalFrequency',
  label: 'Automatic video cleanup',
  enabled: true,
  active: true,
  expression: '0 2 * * *',
  error: null,
  running: false,
  nextRunAt: '2026-09-21T02:00:00.000Z',
  lastRun: null,
};

const lastRun = {
  id: 1, taskKey: 'autoRemovalFrequency', trigger: 'scheduled' as const, status: 'success' as const,
  outcome: 'completed', message: 'Deleted 2 videos.', details: null,
  startedAt: '2026-09-20T02:00:00.000Z', finishedAt: '2026-09-20T02:01:00.000Z',
};

test('renders nothing until the status has loaded', () => {
  const { container } = render(<ScheduleRunStatus status={undefined} />);
  expect(container).toBeEmptyDOMElement();
});

test('shows the next run and that the task has never run', () => {
  render(<ScheduleRunStatus status={base} />);
  expect(screen.getByText(`Next run: ${formatDateTime(base.nextRunAt)}`)).toBeInTheDocument();
  expect(screen.getByText('Last run: never')).toBeInTheDocument();
});

test('describes the last run with its outcome and message', () => {
  render(<ScheduleRunStatus status={{ ...base, lastRun }} />);
  expect(screen.getByText(`Last run: ${formatDateTime(lastRun.startedAt)}, completed: Deleted 2 videos.`)).toBeInTheDocument();
});

test('labels a failed run and notes a manual trigger', () => {
  render(<ScheduleRunStatus status={{ ...base, lastRun: { ...lastRun, trigger: 'manual', status: 'error', message: 'Disk full' } }} />);
  expect(screen.getByText(/Last run: .*, failed \(manual\): Disk full/)).toBeInTheDocument();
});

test('reports a task that is running now instead of a next run', () => {
  render(<ScheduleRunStatus status={{ ...base, running: true }} />);
  expect(screen.getByText('Running now')).toBeInTheDocument();
  expect(screen.queryByText(/Next run:/)).not.toBeInTheDocument();
});

test('warns when the saved expression left the task unscheduled', () => {
  render(<ScheduleRunStatus status={{ ...base, active: false, expression: null, nextRunAt: null, error: 'enter a valid cron expression.' }} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Not scheduled: enter a valid cron expression.');
});

test('warns when a rejected edit left the previous schedule running', () => {
  render(<ScheduleRunStatus status={{ ...base, error: 'must not run more often than every 15 minutes.' }} />);
  expect(screen.getByRole('alert')).toHaveTextContent(
    'The saved schedule was not applied: must not run more often than every 15 minutes. The previous schedule 0 2 * * * is still active.'
  );
});

test('formats times in the server timezone when one is given', () => {
  render(<ScheduleRunStatus status={{ ...base, lastRun }} timeZone="Asia/Tokyo" />);
  expect(screen.getByText(`Next run: ${formatDateTimeInZone(base.nextRunAt, 'Asia/Tokyo')}`)).toBeInTheDocument();
  expect(screen.getByText(`Last run: ${formatDateTimeInZone(lastRun.startedAt, 'Asia/Tokyo')}, completed: Deleted 2 videos.`)).toBeInTheDocument();
});

test('shows no next run for a disabled feature', () => {
  render(<ScheduleRunStatus status={{ ...base, enabled: false, active: false, nextRunAt: null }} />);
  expect(screen.queryByText(/Next run:/)).not.toBeInTheDocument();
  expect(screen.getByText('Last run: never')).toBeInTheDocument();
});
