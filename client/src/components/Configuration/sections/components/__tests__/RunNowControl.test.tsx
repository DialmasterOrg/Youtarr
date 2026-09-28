import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../../test-utils';
import { RunNowControl } from '../RunNowControl';
import { SCHEDULE_FIELDS } from '../../../schedules';
import { ScheduleTaskStatus } from '../../../hooks/useScheduleStatus';

const watchStatusField = SCHEDULE_FIELDS.find((field) => field.key === 'watchStatusSyncFrequency')!;
const cleanupField = SCHEDULE_FIELDS.find((field) => field.key === 'autoRemovalFrequency')!;

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
  field: watchStatusField,
  featureOnInForm: false,
  pending: false,
  timeZone: 'UTC',
  onRun: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders an enabled Run now button and calls onRun on click when available with no confirm', () => {
  const onRun = jest.fn();
  renderWithProviders(<RunNowControl {...baseProps} status={status()} onRun={onRun} />);
  const button = screen.getByRole('button', { name: 'Run Watch status sync now' });
  expect(button).toBeEnabled();
  expect(button).toHaveTextContent('Run now');
  fireEvent.click(button);
  expect(onRun).toHaveBeenCalledTimes(1);
});

test('is disabled with the hint text when status.runNow is blocked', () => {
  renderWithProviders(<RunNowControl {...baseProps} status={status({
    runNow: { available: false, reason: 'cooldown', message: 'x', availableAt: '2026-09-27T12:15:00.000Z' },
  })} />);
  expect(screen.getByRole('button', { name: 'Run Watch status sync now' })).toBeDisabled();
  expect(screen.getByText(/^Ran less than 15 minutes ago\./)).toBeInTheDocument();
});

test('shows Running... and is disabled when status.running', () => {
  renderWithProviders(<RunNowControl {...baseProps} status={status({ running: true })} />);
  const button = screen.getByRole('button', { name: 'Watch status sync is running' });
  expect(button).toBeDisabled();
  expect(button).toHaveTextContent('Running...');
});

test('shows Running... when status.runNow.reason is running, even if status.running is false', () => {
  renderWithProviders(<RunNowControl {...baseProps} status={status({
    running: false,
    runNow: { available: false, reason: 'running', message: 'Already running', availableAt: null },
  })} />);
  const button = screen.getByRole('button', { name: 'Watch status sync is running' });
  expect(button).toBeDisabled();
  expect(button).toHaveTextContent('Running...');
});

test('shows Starting... and is disabled while pending', () => {
  renderWithProviders(<RunNowControl {...baseProps} status={status()} pending />);
  const button = screen.getByRole('button', { name: 'Starting Watch status sync' });
  expect(button).toBeDisabled();
  expect(button).toHaveTextContent('Starting...');
});

test('renders the hint link for downloads-paused', () => {
  renderWithProviders(<RunNowControl {...baseProps} status={status({
    runNow: { available: false, reason: 'downloads-paused', message: 'Downloads are paused.', availableAt: null },
  })} />);
  expect(screen.getByRole('link', { name: 'Storage limits' })).toHaveAttribute('href', '/settings/storage-limits');
});

test('cleanup field: clicking opens a confirm dialog; Cancel closes without calling onRun; confirm calls onRun once', () => {
  const onRun = jest.fn();
  renderWithProviders(<RunNowControl {...baseProps} field={cleanupField} status={status({ key: 'autoRemovalFrequency', label: 'Automatic video cleanup' })} onRun={onRun} />);

  fireEvent.click(screen.getByRole('button', { name: 'Run Automatic video cleanup now' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText('Run automatic video cleanup now?')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(onRun).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Run Automatic video cleanup now' }));
  fireEvent.click(screen.getByRole('button', { name: 'Run cleanup' }));
  expect(onRun).toHaveBeenCalledTimes(1);
});

test('shows error in an alert', () => {
  renderWithProviders(<RunNowControl {...baseProps} status={status()} error="Could not start the task." />);
  expect(screen.getByRole('alert')).toHaveTextContent('Could not start the task.');
});

test('renders nothing until status has loaded', () => {
  const { container } = renderWithProviders(<RunNowControl {...baseProps} status={undefined} />);
  expect(container).toBeEmptyDOMElement();
});
