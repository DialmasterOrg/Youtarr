import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
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
      <MemoryRouter>
        <Story />
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
];

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [http.get('/runningjobs', () => HttpResponse.json([]))],
    },
  },
};

export const WithJobs: Story = {
  parameters: {
    msw: {
      handlers: [http.get('/runningjobs', () => HttpResponse.json(jobs))],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Video titles are shown in the info popover, not in the table cell.
    const infoIcon = await canvas.findByTestId('InfoIcon');
    const infoButton = infoIcon.closest('button');
    await expect(infoButton).toBeTruthy();

    await userEvent.click(infoButton as HTMLElement);

    const body = within(canvasElement.ownerDocument.body);
    await expect(
      await body.findByText((text) => text.toLowerCase().includes('sample video 1'))
    ).toBeInTheDocument();
  },
};
