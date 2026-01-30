import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { expect, fn, userEvent, within } from '@storybook/test';
import ChannelVideosHeader from './ChannelVideosHeader';
import { ChannelVideo } from '../../types/ChannelVideo';
import { ThemeEngineProvider } from '../../contexts/ThemeEngineContext';

const paginatedVideos: ChannelVideo[] = [
  {
    title: 'First Video',
    youtube_id: 'vid1',
    publishedAt: '2024-01-01T00:00:00Z',
    thumbnail: 'https://i.ytimg.com/vi/vid1/mqdefault.jpg',
    added: false,
    removed: false,
    duration: 120,
    media_type: 'video',
  },
];

const meta: Meta<typeof ChannelVideosHeader> = {
  title: 'Components/ChannelPage/ChannelVideosHeader',
  component: ChannelVideosHeader,
  decorators: [
    (Story) => (
      <ThemeEngineProvider>
        <Story />
      </ThemeEngineProvider>
    ),
  ],
  args: {
    isMobile: false,
    viewMode: 'grid',
    searchQuery: '',
    hideDownloaded: false,
    totalCount: 1,
    oldestVideoDate: '2024-01-01T00:00:00Z',
    fetchingAllVideos: false,
    checkedBoxes: ['vid1'],
    selectedForDeletion: [],
    selectionMode: 'download',
    deleteLoading: false,
    paginatedVideos,
    autoDownloadsEnabled: true,
    selectedTab: 'videos',
    maxRating: '',
    onViewModeChange: fn(),
    onSearchChange: fn(),
    onHideDownloadedChange: fn(),
    onAutoDownloadChange: fn(),
    onRefreshClick: fn(),
    onDownloadClick: fn(),
    onSelectAll: fn(),
    onClearSelection: fn(),
    onDeleteClick: fn(),
    onBulkIgnoreClick: fn(),
    onInfoIconClick: fn(),
    onMaxRatingChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ChannelVideosHeader>;

export const DownloadSelection: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /download 1 video/i }));
    await expect(args.onDownloadClick).toHaveBeenCalledTimes(1);
  },
};

export const ActionBarInteractions: Story = {
  args: {
    checkedBoxes: [],
    selectedForDeletion: ['vid1'],
    selectionMode: 'download',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const selectAllButton = canvas.getByRole('button', { name: /select all this page/i });
    await userEvent.click(selectAllButton);
    await expect(args.onSelectAll).toHaveBeenCalledTimes(1);

    const deleteButton = canvas.getByRole('button', { name: /delete 1/i });
    await userEvent.hover(deleteButton);
    expect(deleteButton.className).toContain('intent-danger');
  },
};
