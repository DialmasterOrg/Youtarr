jest.mock('axios', () => ({ get: jest.fn(), isAxiosError: jest.fn(() => false) }));

import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';
import { renderWithProviders } from '../../../../test-utils';
import { formatDateTimeInZone } from '../../../../utils/formatters';
import { SchedulingSection } from '../SchedulingSection';
import { ScheduleTaskStatus } from '../../hooks/useScheduleStatus';

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
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({ data: { tasks: [] } });
});

test('groups the eight schedules and shows the server timezone', () => {
  renderWithProviders(<SchedulingSection {...props} />);
  expect(screen.getAllByRole('region')).toHaveLength(8);
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
  expect(cleanup.getByText(/Last run: .*completed: Deleted 2 videos and freed 1\.20 GB\./)).toBeInTheDocument();
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

test('lists upcoming runs in time order', async () => {
  axios.get.mockResolvedValue({ data: { tasks: [
    status({ key: 'videoRescanFrequency', label: 'Rescan files on disk', nextRunAt: '2026-09-21T03:30:00.000Z' }),
    status({ nextRunAt: '2026-09-21T02:00:00.000Z' }),
    status({ key: 'channelDownloadFrequency', label: 'Automatic downloads', enabled: false, active: false, nextRunAt: null }),
  ] } });
  renderWithProviders(<SchedulingSection {...props} />);
  const upcoming = within(await screen.findByRole('list', { name: 'Upcoming runs' }));
  await waitFor(() => expect(upcoming.getAllByRole('listitem')).toHaveLength(2));
  const items = upcoming.getAllByRole('listitem').map((item) => item.textContent);
  expect(items[0]).toMatch(/Automatic video cleanup/);
  expect(items[0]).toContain(formatDateTimeInZone('2026-09-21T02:00:00.000Z', 'Europe/Paris'));
  expect(items[1]).toMatch(/Rescan files on disk/);
});

test('says so when nothing is scheduled', () => {
  renderWithProviders(<SchedulingSection {...props} />);
  expect(screen.getByText('No tasks are currently scheduled.')).toBeInTheDocument();
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
