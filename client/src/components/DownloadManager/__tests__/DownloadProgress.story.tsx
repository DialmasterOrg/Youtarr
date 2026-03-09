import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import React, { useRef } from 'react';
import { MemoryRouter } from 'react-router-dom';
import DownloadProgress from '../DownloadProgress';
import WebSocketContext from '../../../contexts/WebSocketContext';
import { Job } from '../../../types/Job';

const pendingJobs: Job[] = [
  {
    id: 'job-1',
    jobType: 'Channel Downloads',
    status: 'Queued',
    output: 'Queued',
    timeCreated: Date.now() - 1000 * 60 * 2,
    timeInitiated: Date.now() - 1000 * 60 * 2,
    data: { videos: [] },
  },
];

const meta: Meta<typeof DownloadProgress> = {
  title: 'Components/DownloadManager/DownloadProgress',
  component: DownloadProgress,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <WebSocketContext.Provider
          value={{
            socket: null,
            subscribe: () => {},
            unsubscribe: () => {},
          }}
        >
          <Story />
        </WebSocketContext.Provider>
      </MemoryRouter>
    ),
  ],
  render: (args) => {
    const downloadProgressRef = useRef({ index: null, message: '' });
    const downloadInitiatedRef = useRef(false);
    return (
      <DownloadProgress
        {...args}
        downloadProgressRef={downloadProgressRef}
        downloadInitiatedRef={downloadInitiatedRef}
      />
    );
  },
  args: {
    pendingJobs,
    token: 'storybook-token',
  },
};

export default meta;
type Story = StoryObj<typeof DownloadProgress>;

export const ShowsQueuedJobs: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Download Progress')).toBeInTheDocument();
    await expect(canvas.getByText('1 job queued')).toBeInTheDocument();
  },
};
