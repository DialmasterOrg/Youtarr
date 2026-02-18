import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import MobileFilterDrawer from '../MobileFilterDrawer';
import { VideoFilters } from '../../hooks/useChannelVideoFilters';

const defaultFilters: VideoFilters = {
  minDuration: null,
  maxDuration: null,
  dateFrom: null,
  dateTo: null,
};

const meta: Meta<typeof MobileFilterDrawer> = {
  title: 'Components/ChannelPage/MobileFilterDrawer',
  component: MobileFilterDrawer,
  args: {
    open: true,
    onClose: fn(),
    filters: defaultFilters,
    inputMinDuration: null,
    inputMaxDuration: null,
    onMinDurationChange: fn(),
    onMaxDurationChange: fn(),
    onDateFromChange: fn(),
    onDateToChange: fn(),
    onClearAll: fn(),
    hasActiveFilters: true,
  },
};

export default meta;

type Story = StoryObj<typeof MobileFilterDrawer>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText('Filters')).toBeInTheDocument();

    await userEvent.click(body.getByRole('button', { name: /clear all/i }));
    await expect(args.onClearAll).toHaveBeenCalledTimes(1);

    await userEvent.click(body.getByTestId('drawer-close-button'));
    await expect(args.onClose).toHaveBeenCalledTimes(1);
  },
};

export const HideDateFilter: Story = {
  args: {
    hideDateFilter: true,
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText('Shorts do not have date information')).toBeInTheDocument();
  },
};
