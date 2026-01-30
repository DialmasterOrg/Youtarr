import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within, waitFor } from '@storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DownloadManager from './DownloadManager';

const meta: Meta<typeof DownloadManager> = {
  title: 'Pages/DownloadManager',
  component: DownloadManager,
  args: {
    token: 'storybook-token',
  },
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/downloads/history']}>
        <Routes>
          <Route path="/downloads/*" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DownloadManager>;

const jobs = [
  {
    id: 'job-1',
    jobType: 'download',
    status: 'Running',
    output: 'Downloading…',
    timeCreated: Date.now() - 300_000,
    timeInitiated: Date.now() - 240_000,
    data: {
      videos: [
        {
          id: 1,
          youtubeId: 'abc123',
          youTubeChannelName: 'Test Channel',
          youTubeVideoName: 'Sample Video 1',
          timeCreated: '2024-01-15T10:30:00',
          originalDate: '20240110',
          duration: 600,
          description: 'A sample video',
          removed: false,
          fileSize: '1073741824',
        },
      ],
    },
  },
  {
    id: 'job-2',
    jobType: 'Channel Downloads',
    status: 'Complete',
    output: 'Finished',
    timeCreated: Date.now() - 900_000,
    timeInitiated: Date.now() - 840_000,
    data: {
      videos: [
        {
          id: 2,
          youtubeId: 'def456',
          youTubeChannelName: 'Test Channel',
          youTubeVideoName: 'Sample Video 2',
          timeCreated: '2024-01-15T11:30:00',
          originalDate: '20240112',
          duration: 420,
          description: 'Another sample video',
          removed: false,
          fileSize: '524288000',
        },
        {
          id: 3,
          youtubeId: 'ghi789',
          youTubeChannelName: 'Test Channel',
          youTubeVideoName: 'Sample Video 3',
          timeCreated: '2024-01-15T12:30:00',
          originalDate: '20240113',
          duration: 300,
          description: 'Third sample video',
          removed: false,
          fileSize: '734003200',
        },
      ],
    },
  },
];

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [http.get('/runningjobs', () => HttpResponse.json([]))],
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText(/download history/i)).toBeInTheDocument();
    await expect(await body.findByText(/no jobs currently/i)).toBeInTheDocument();
    
    // Allow state updates from potential polling or intervals to settle
    await waitFor(() => {}, { timeout: 1100 }).catch(() => {});
  },
};

export const WithJobs: Story = {
  parameters: {
    msw: {
      handlers: [http.get('/runningjobs', () => HttpResponse.json(jobs))],
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText(/download history/i)).toBeInTheDocument();
    await expect(await body.findByText(/sample video 1/i)).toBeInTheDocument();
    await userEvent.click(await body.findByText(/multiple \(2\)/i));
    await expect(await body.findByText(/sample video 2/i)).toBeInTheDocument();
  },
};
