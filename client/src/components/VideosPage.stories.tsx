import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import VideosPage from './VideosPage';

const meta: Meta<typeof VideosPage> = {
  title: 'Pages/VideosPage',
  component: VideosPage,
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
type Story = StoryObj<typeof VideosPage>;

export const Default: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/getVideos', () =>
          HttpResponse.json({
            videos: [
              {
                id: 1,
                youtubeId: 'abc123',
                youTubeChannelName: 'Tech Channel',
                youTubeVideoName: 'How to Code',
                timeCreated: '2024-01-15T10:30:00',
                originalDate: '20240110',
                duration: 600,
                description: 'A coding tutorial',
                removed: false,
                fileSize: '1073741824',
              },
              {
                id: 2,
                youtubeId: 'def456',
                youTubeChannelName: 'Gaming Channel',
                youTubeVideoName: 'Game Review',
                timeCreated: '2024-01-14T08:00:00',
                originalDate: '20240108',
                duration: 1200,
                description: 'Game review video',
                removed: false,
                fileSize: '2147483648',
              },
            ],
            total: 2,
            totalPages: 1,
            page: 1,
            limit: 12,
            channels: ['Gaming Channel', 'Tech Channel'],
            enabledChannels: [
              { channel_id: 'UC1', uploader: 'Tech Channel', enabled: true },
              { channel_id: 'UC2', uploader: 'Gaming Channel', enabled: true },
            ],
          })
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('How to Code')).toBeInTheDocument();
    const searchInput = await canvas.findByPlaceholderText(/search videos by name or channel/i);
    await userEvent.type(searchInput, 'Tech');
    await expect(searchInput).toHaveValue('Tech');
  },
};

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/getVideos', () =>
          HttpResponse.json({
            videos: [],
            total: 0,
            totalPages: 1,
            page: 1,
            limit: 12,
            channels: [],
            enabledChannels: [],
          })
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No videos found')).toBeInTheDocument();
  },
};

export const Error: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/getVideos', () => HttpResponse.json({ error: 'Backend down' }, { status: 500 })),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(/failed to load videos/i)
    ).toBeInTheDocument();
  },
};
