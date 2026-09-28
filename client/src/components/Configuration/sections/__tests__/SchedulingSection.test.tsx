jest.mock('axios', () => ({ get: jest.fn(), isAxiosError: jest.fn(() => false) }));

// useRunScheduledTask has its own test coverage; mock it with a mutable
// return object so each test can shape pending/error state directly.
const mockRunScheduledTaskReturn: {
  pending: Record<string, boolean>;
  errors: Record<string, string>;
  runTask: jest.Mock;
} = {
  pending: {},
  errors: {},
  runTask: jest.fn(),
};
jest.mock('../../hooks/useRunScheduledTask', () => ({
  useRunScheduledTask: () => mockRunScheduledTaskReturn,
}));

// Deep links arrive as a location hash; MemoryRouter in renderWithProviders starts at '/'.
let mockHash = '';
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return { ...actual, useLocation: () => ({ ...actual.useLocation(), hash: mockHash }) };
});

import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';
import { renderWithProviders } from '../../../../test-utils';
import { formatDateTimeInZone } from '../../../../utils/formatters';
import { SchedulingSection } from '../SchedulingSection';
import { ScheduleTaskStatus } from '../../hooks/useScheduleStatus';
import { SCHEDULE_FIELDS } from '../../schedules';

const axios = require('axios');

const props = {
  config: DEFAULT_CONFIG,
  deploymentEnvironment: { timezone: 'Europe/Paris', platform: null, isWsl: false },
  isPlatformManaged: { plexUrl: false, authEnabled: true, useTmpForDownloads: false, ytdlpUpdates: false },
  onConfigChange: jest.fn(),
  fieldErrors: {},
  token: 'tok',
};

const status = (overrides: Partial<ScheduleTaskStatus>): ScheduleTaskStatus => ({
  key: 'autoRemovalFrequency',
  label: 'Automatic video cleanup',
  enabled: true,
  active: true,
  expression: '0 2 * * *',
  error: null,
  running: false,
  nextRunAt: null,
  lastRun: null,
  runNow: { available: true, reason: null, message: null, availableAt: null },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({ data: { tasks: [] } });
  mockRunScheduledTaskReturn.pending = {};
  mockRunScheduledTaskReturn.errors = {};
  mockRunScheduledTaskReturn.runTask = jest.fn();
  mockHash = '';
});

const rowHeader = (label: string) => within(screen.getByRole('region', { name: label }))
  .getByRole('button', { name: new RegExp(`^${label}`) });

test('groups the eight schedules and shows the server timezone', () => {
  renderWithProviders(<SchedulingSection {...props} />);
  SCHEDULE_FIELDS.forEach((field) => {
    expect(screen.getByRole('region', { name: field.label })).toBeInTheDocument();
  });
  expect(screen.getByRole('heading', { name: 'Downloads and sync' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Maintenance' })).toBeInTheDocument();
  expect(screen.getByText('Europe/Paris')).toBeInTheDocument();
  expect(screen.getByText(/that occurrence is skipped/)).toBeInTheDocument();
});

test('explains that an idle schedule waits for its feature and links to where to turn it on', () => {
  renderWithProviders(<SchedulingSection {...props} />);
  const downloads = within(screen.getByRole('region', { name: 'Automatic downloads' }));
  expect(downloads.getByText(/Automatic downloads are off, so this schedule is idle/)).toBeInTheDocument();
  expect(downloads.getByRole('link', { name: 'Turn on in Core settings' })).toHaveAttribute('href', '/settings/core');
});

test('disabled video removal still allows scheduling empty-folder cleanup', () => {
  const onConfigChange = jest.fn();
  renderWithProviders(<SchedulingSection {...props} onConfigChange={onConfigChange} />);
  const cleanup = within(screen.getByRole('region', { name: 'Automatic video cleanup' }));
  expect(cleanup.getByText(/removes empty channel folders only/)).toBeInTheDocument();
  expect(cleanup.getByRole('link', { name: 'Turn on in Auto Removal settings' })).toHaveAttribute('href', '/settings/autoremove');
  fireEvent.change(cleanup.getByLabelText('Time (server timezone)'), { target: { value: '18:00' } });
  expect(onConfigChange).toHaveBeenCalledWith({ autoRemovalFrequency: '0 18 * * *' });
});

test('shows the next and last run reported by the server', async () => {
  axios.get.mockResolvedValue({ data: { tasks: [status({
    nextRunAt: '2026-09-21T00:00:00.000Z',
    lastRun: {
      id: 1, taskKey: 'autoRemovalFrequency', trigger: 'scheduled', status: 'success', outcome: 'completed',
      message: 'Deleted 2 videos and freed 1.20 GB.', details: null,
      startedAt: '2026-09-20T00:00:00.000Z', finishedAt: '2026-09-20T00:01:00.000Z',
    },
  })] } });
  renderWithProviders(<SchedulingSection {...props} />);
  const cleanup = within(await screen.findByRole('region', { name: 'Automatic video cleanup' }));
  await waitFor(() => {
    expect(cleanup.getByText(`Next run: ${formatDateTimeInZone('2026-09-21T00:00:00.000Z', 'Europe/Paris')}`)).toBeInTheDocument();
  });
  expect(cleanup.getByText(/Last run: .*completed in 1m: Deleted 2 videos and freed 1\.20 GB\./)).toBeInTheDocument();
});

test('warns when the saved expression could not be scheduled', async () => {
  axios.get.mockResolvedValue({ data: { tasks: [status({
    active: false, expression: null, error: 'must not run more often than every 15 minutes.',
  })] } });
  renderWithProviders(<SchedulingSection {...props} />);
  await waitFor(() => {
    expect(screen.getByText(/Not scheduled: must not run more often than every 15 minutes/)).toBeInTheDocument();
  });
});

test('summarizes the tasks and names the next run', async () => {
  axios.get.mockResolvedValue({ data: { tasks: [
    status({ key: 'videoRescanFrequency', label: 'Rescan files on disk', nextRunAt: '2099-09-21T03:30:00.000Z' }),
    status({ nextRunAt: '2099-09-21T02:00:00.000Z', running: true }),
    status({ key: 'channelDownloadFrequency', label: 'Automatic downloads', enabled: false, active: false, nextRunAt: null }),
  ] } });
  renderWithProviders(<SchedulingSection {...props} />);
  const summary = await screen.findByLabelText('Schedule summary');
  expect(summary).toHaveTextContent(/^3 tasks · 1 running · next: Automatic video cleanup in /);
});

test('shows no summary until the status loads', () => {
  axios.get.mockReturnValue(new Promise(() => {}));
  renderWithProviders(<SchedulingSection {...props} />);
  expect(screen.queryByLabelText('Schedule summary')).not.toBeInTheDocument();
});

test('every task starts collapsed', () => {
  renderWithProviders(<SchedulingSection {...props} />);
  SCHEDULE_FIELDS.forEach((field) => {
    expect(rowHeader(field.label)).toHaveAttribute('aria-expanded', 'false');
  });
});

test('a deep link opens that task', () => {
  mockHash = '#autoRemovalFrequency';
  renderWithProviders(<SchedulingSection {...props} />);
  expect(rowHeader('Automatic video cleanup')).toHaveAttribute('aria-expanded', 'true');
  expect(rowHeader('Session cleanup')).toHaveAttribute('aria-expanded', 'false');
});

test('a save error opens the affected task and flags it in the header', () => {
  renderWithProviders(<SchedulingSection {...props}
    config={{ ...DEFAULT_CONFIG, autoRemovalFrequency: 'invalid' }}
    fieldErrors={{ autoRemovalFrequency: 'Enter a valid cron expression.' }}
  />);
  expect(rowHeader('Automatic video cleanup')).toHaveAttribute('aria-expanded', 'true');
  expect(rowHeader('Automatic video cleanup')).toHaveTextContent('Invalid schedule');
});

test('a failed Run now request opens that task', () => {
  mockRunScheduledTaskReturn.errors = { sessionCleanupFrequency: 'Could not start the task.' };
  renderWithProviders(<SchedulingSection {...props} />);
  expect(rowHeader('Session cleanup')).toHaveAttribute('aria-expanded', 'true');
});

test('marks a schedule changed since the last save', () => {
  renderWithProviders(<SchedulingSection {...props}
    savedConfig={DEFAULT_CONFIG}
    config={{ ...DEFAULT_CONFIG, sessionCleanupFrequency: '30 4 * * *' }}
  />);
  expect(rowHeader('Session cleanup')).toHaveTextContent('Unsaved');
  expect(rowHeader('Repair library records')).not.toHaveTextContent('Unsaved');
});

test('treats a schedule missing from the saved config like an empty one', () => {
  const { sessionCleanupFrequency: _omitted, ...savedWithoutKey } = DEFAULT_CONFIG;
  renderWithProviders(<SchedulingSection {...props}
    savedConfig={savedWithoutKey as typeof DEFAULT_CONFIG}
    config={{ ...DEFAULT_CONFIG, sessionCleanupFrequency: '' }}
  />);
  expect(rowHeader('Session cleanup')).not.toHaveTextContent('Unsaved');
});

test('disables yt-dlp scheduling on managed platforms', () => {
  renderWithProviders(<SchedulingSection {...props} isPlatformManaged={{ ...props.isPlatformManaged, ytdlpUpdates: true }} />);
  const updates = within(screen.getByRole('region', { name: 'Automatic yt-dlp updates' }));
  expect(updates.getByText('Updates are managed by your hosting platform.')).toBeInTheDocument();
  expect(updates.getByLabelText('Time (server timezone)')).toBeDisabled();
});

test('warns when a task other than downloads runs more than once an hour, but still allows it', () => {
  renderWithProviders(<SchedulingSection {...props}
    config={{ ...DEFAULT_CONFIG, videoRescanFrequency: '*/15 * * * *', channelDownloadFrequency: '*/15 * * * *' }}
  />);
  const rescan = within(screen.getByRole('region', { name: 'Rescan files on disk' }));
  expect(rescan.getByText(/keeps the disk busy for little benefit/)).toBeInTheDocument();
  expect(rescan.getByRole('button', { name: 'Interval' })).not.toBeDisabled();
  const downloads = within(screen.getByRole('region', { name: 'Automatic downloads' }));
  expect(downloads.queryByText(/more than once an hour/)).not.toBeInTheDocument();
});

test('shows no frequency warning for an hourly or slower schedule', () => {
  renderWithProviders(<SchedulingSection {...props} />);
  expect(screen.queryByText(/more than once an hour/)).not.toBeInTheDocument();
});

test('shows errors beside the affected schedule', () => {
  renderWithProviders(<SchedulingSection {...props}
    config={{ ...DEFAULT_CONFIG, autoRemovalFrequency: 'invalid' }}
    fieldErrors={{ autoRemovalFrequency: 'Enter a valid cron expression.' }}
  />);
  const cleanup = within(screen.getByRole('region', { name: 'Automatic video cleanup' }));
  expect(cleanup.getByText('Enter a valid cron expression.')).toBeInTheDocument();
});

test('each schedule card renders a Run now button, and clicking one starts that task', async () => {
  axios.get.mockResolvedValue({ data: { tasks: [status({ key: 'channelDownloadFrequency', label: 'Automatic downloads' })] } });
  renderWithProviders(<SchedulingSection {...props} />);
  const button = await screen.findByRole('button', { name: 'Run Automatic downloads now' });
  fireEvent.click(button);
  expect(mockRunScheduledTaskReturn.runTask).toHaveBeenCalledWith('channelDownloadFrequency');
});

test('the yt-dlp card has no Run now button on a managed platform', async () => {
  axios.get.mockResolvedValue({ data: { tasks: [status({ key: 'ytdlpUpdateFrequency', label: 'Automatic yt-dlp updates' })] } });
  renderWithProviders(<SchedulingSection {...props} isPlatformManaged={{ ...props.isPlatformManaged, ytdlpUpdates: true }} />);
  await screen.findByRole('region', { name: 'Automatic yt-dlp updates' });
  expect(screen.queryByRole('button', { name: 'Run Automatic yt-dlp updates now' })).not.toBeInTheDocument();
});

test('shows the save-first hint when the form has the feature on but the saved settings do not yet', async () => {
  axios.get.mockResolvedValue({ data: { tasks: [status({
    key: 'watchStatusSyncFrequency', label: 'Watch status sync',
    runNow: { available: false, reason: 'disabled', message: 'x', availableAt: null },
  })] } });
  renderWithProviders(<SchedulingSection {...props} config={{ ...DEFAULT_CONFIG, watchStatusSyncEnabled: true }} />);
  await waitFor(() => {
    expect(screen.getByText('Save your settings first: Run now uses the saved settings.')).toBeInTheDocument();
  });
});

test('automatic downloads off still allows Run now when the server reports it available', async () => {
  axios.get.mockResolvedValue({ data: { tasks: [status({ key: 'channelDownloadFrequency', label: 'Automatic downloads' })] } });
  renderWithProviders(<SchedulingSection {...props} config={{ ...DEFAULT_CONFIG, channelAutoDownload: false }} />);
  const downloads = within(await screen.findByRole('region', { name: 'Automatic downloads' }));
  expect(downloads.getByText(/Automatic downloads are off, so this schedule is idle/)).toBeInTheDocument();
  const button = downloads.getByRole('button', { name: 'Run Automatic downloads now' });
  expect(button).toBeEnabled();
  expect(downloads.queryByText('Available once this is turned on in Core settings.')).not.toBeInTheDocument();
  fireEvent.click(button);
  expect(mockRunScheduledTaskReturn.runTask).toHaveBeenCalledWith('channelDownloadFrequency');
});

test('shows Starting... only for the task that is pending', async () => {
  mockRunScheduledTaskReturn.pending = { channelDownloadFrequency: true };
  axios.get.mockResolvedValue({ data: { tasks: [
    status({ key: 'channelDownloadFrequency', label: 'Automatic downloads' }),
    status({ key: 'watchStatusSyncFrequency', label: 'Watch status sync' }),
  ] } });
  renderWithProviders(<SchedulingSection {...props} />);
  const downloadsButton = await screen.findByRole('button', { name: 'Starting Automatic downloads' });
  expect(downloadsButton).toHaveTextContent('Starting...');
  const watchButton = screen.getByRole('button', { name: 'Run Watch status sync now' });
  expect(watchButton).toHaveTextContent('Run now');
});

test('the info alert mentions Run now', () => {
  renderWithProviders(<SchedulingSection {...props} />);
  expect(screen.getByText(/Run now starts a task immediately with your saved settings\./)).toBeInTheDocument();
});
