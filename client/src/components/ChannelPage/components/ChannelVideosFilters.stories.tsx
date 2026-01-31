import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import ChannelVideosFilters from './ChannelVideosFilters';
import { VideoFilters } from '../hooks/useChannelVideoFilters';

const activeFilters: VideoFilters = {
  minDuration: 5,
  maxDuration: 20,
  dateFrom: new Date(2024, 5, 15),
  dateTo: new Date(2024, 5, 20),
};

const meta: Meta<typeof ChannelVideosFilters> = {
  title: 'Components/ChannelPage/ChannelVideosFilters',
  component: ChannelVideosFilters,
  args: {
    isMobile: false,
    filters: activeFilters,
    inputMinDuration: 5,
    inputMaxDuration: 20,
    onMinDurationChange: fn(),
    onMaxDurationChange: fn(),
    onDateFromChange: fn(),
    onDateToChange: fn(),
    onClearAll: fn(),
    hasActiveFilters: true,
    activeFilterCount: 2,
    filtersExpanded: true,
  },
};

export default meta;

type Story = StoryObj<typeof ChannelVideosFilters>;

export const DesktopExpanded: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /clear all/i }));
    await expect(args.onClearAll).toHaveBeenCalledTimes(1);
  },
};

export const MobileDrawer: Story = {
  args: {
    isMobile: true,
    filtersExpanded: false,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await userEvent.click(canvas.getByRole('button', { name: /filters/i }));
    await expect(body.getByRole('button', { name: /clear all/i })).toBeInTheDocument();

    await userEvent.click(body.getByRole('button', { name: /clear all/i }));
    await expect(args.onClearAll).toHaveBeenCalled();
  },
};
