import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import ChannelVideosHeader from '../ChannelVideosHeader';
import { ChannelVideo } from '../../../types/ChannelVideo';

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
    selectionMode: null,
    deleteLoading: false,
    paginatedVideos,
    autoDownloadsEnabled: true,
    selectedTab: 'videos',
    maxRating: '',
    onViewModeChange: fn(),
    onSearchChange: fn(),
    onHideDownloadedChange: fn(),
    onRefreshClick: fn(),
    onDownloadClick: fn(),
    onSelectAllDownloaded: fn(),
    onSelectAllNotDownloaded: fn(),
    onClearSelection: fn(),
    onDeleteClick: fn(),
    onBulkIgnoreClick: fn(),
    onInfoIconClick: fn(),
    onMaxRatingChange: fn(),
    onAutoDownloadToggle: fn(),
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
    selectedForDeletion: [],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const actionsButton = canvas.getByRole('button', { name: /actions/i });
    await userEvent.click(actionsButton);

    const body = within(canvasElement.ownerDocument.body);
    const selectAllButton = await body.findByText(/select all \(not downloaded\)/i);
    await userEvent.click(selectAllButton);
    await expect(args.onSelectAllNotDownloaded).toHaveBeenCalledTimes(1);

    await userEvent.click(actionsButton);
    const clearSelectionButton = await body.findByText(/clear selection/i);
    await userEvent.click(clearSelectionButton);
    await expect(args.onClearSelection).toHaveBeenCalledTimes(1);
  },
};
