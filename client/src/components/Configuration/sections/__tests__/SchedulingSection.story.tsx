import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';
import { SchedulingSection } from '../SchedulingSection';

const tomorrowAt = (hour: number, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const yesterdayAt = (hour: number, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const run = (taskKey: string, overrides: Record<string, unknown> = {}) => ({
  id: 1,
  taskKey,
  trigger: 'scheduled',
  status: 'success',
  outcome: 'completed',
  message: null,
  details: null,
  startedAt: yesterdayAt(2),
  finishedAt: yesterdayAt(2, 1),
  ...overrides,
});

const tasks = [
  { key: 'channelDownloadFrequency', label: 'Automatic downloads', enabled: false, active: false, expression: null, error: null, running: false, nextRunAt: null, lastRun: null },
  { key: 'watchStatusSyncFrequency', label: 'Watch status sync', enabled: true, active: true, expression: '0 */4 * * *', error: null, running: false, nextRunAt: tomorrowAt(0), lastRun: run('watchStatusSyncFrequency', { message: 'Synced 2 servers.' }) },
  { key: 'autoRemovalFrequency', label: 'Automatic video cleanup', enabled: true, active: true, expression: '0 2 * * *', error: null, running: false, nextRunAt: tomorrowAt(2), lastRun: run('autoRemovalFrequency', { message: 'Deleted 12 videos and freed 8.10 GB.' }) },
  { key: 'videoRescanFrequency', label: 'Rescan files on disk', enabled: true, active: true, expression: '30 3 * * *', error: null, running: true, nextRunAt: tomorrowAt(3, 30), lastRun: run('videoRescanFrequency', { message: 'Scanned 8,421 videos: 12 updated, 3 marked missing.' }) },
  { key: 'ytdlpUpdateFrequency', label: 'Automatic yt-dlp updates', enabled: true, active: false, expression: null, error: 'must not run more often than every 15 minutes.', running: false, nextRunAt: null, lastRun: run('ytdlpUpdateFrequency', { status: 'error', outcome: 'error', message: 'Permission denied.' }) },
  { key: 'archiveBackfillFrequency', label: 'Repair library records', enabled: true, active: true, expression: '20 2 * * *', error: null, running: false, nextRunAt: tomorrowAt(2, 20), lastRun: run('archiveBackfillFrequency', { trigger: 'startup' }) },
  { key: 'sessionCleanupFrequency', label: 'Session cleanup', enabled: true, active: true, expression: '0 3 * * *', error: null, running: false, nextRunAt: tomorrowAt(3), lastRun: null },
];

const meta: Meta<typeof SchedulingSection> = {
  title: 'Components/Configuration/Sections/SchedulingSection',
  component: SchedulingSection,
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
  parameters: {
    layout: 'padded',
    msw: {
      handlers: [http.get('/api/schedules', () => HttpResponse.json({ tasks }))],
    },
  },
  args: {
    config: DEFAULT_CONFIG,
    deploymentEnvironment: { timezone: 'Europe/Paris', isWsl: false },
    isPlatformManaged: { plexUrl: false, authEnabled: true, useTmpForDownloads: false, ytdlpUpdates: false },
    fieldErrors: {},
    token: 'story-token',
  },
  render: (args) => {
    const [config, setConfig] = useState(args.config);
    return <SchedulingSection {...args} config={config}
      onConfigChange={(updates) => setConfig((current) => ({ ...current, ...updates }))}
    />;
  },
};
export default meta;
type Story = StoryObj<typeof SchedulingSection>;
export const Default: Story = {};
export const CustomCronError: Story = {
  args: {
    config: { ...DEFAULT_CONFIG, autoRemovalFrequency: 'invalid' },
    fieldErrors: { autoRemovalFrequency: 'Automatic video cleanup: enter a valid cron expression.' },
  },
};
