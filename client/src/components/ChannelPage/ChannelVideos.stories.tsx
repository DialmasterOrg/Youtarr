import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import ChannelVideos from './ChannelVideos';

const meta: Meta<typeof ChannelVideos> = {
  title: 'Pages/ChannelPage/ChannelVideos',
  component: ChannelVideos,
  args: {
    token: 'storybook-token',
    channelId: 'chan-1',
    channelAutoDownloadTabs: 'video',
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [
        http.get('/api/channels/chan-1/tabs', () =>
          HttpResponse.json({ availableTabs: ['videos'] })
        ),
        http.get('/getchannelvideos/chan-1', () =>
          HttpResponse.json({
            videos: [],
            totalCount: 0,
            oldestVideoDate: null,
            videoFail: false,
            autoDownloadsEnabled: false,
            availableTabs: ['videos'],
          })
        ),
        http.get('/getconfig', () =>
          HttpResponse.json({ preferredResolution: '1080' })
        ),
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ChannelVideos>;

export const EmptyState: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No videos found')).toBeInTheDocument();

    const searchInput = canvas.getByPlaceholderText('Search videos...') as HTMLInputElement;
    await userEvent.type(searchInput, 'trailer');
    await expect(searchInput).toHaveValue('trailer');
  },
};
