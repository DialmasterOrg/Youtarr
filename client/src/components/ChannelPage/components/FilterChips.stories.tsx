import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import FilterChips from './FilterChips';
import { VideoFilters } from '../hooks/useChannelVideoFilters';

const meta: Meta<typeof FilterChips> = {
  title: 'Components/ChannelPage/FilterChips',
  component: FilterChips,
  args: {
    onClearDuration: fn(),
    onClearDateRange: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof FilterChips>;

const dateFrom = new Date(2024, 5, 15);
const dateTo = new Date(2024, 5, 20);
const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

const filters: VideoFilters = {
  minDuration: 5,
  maxDuration: 20,
  dateFrom,
  dateTo,
};

export const WithDurationAndDate: Story = {
  args: {
    filters,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const durationChip = canvas.getByRole('button', { name: /5-20 min/i });
    const dateLabel = `${dateFormatter.format(dateFrom)} - ${dateFormatter.format(dateTo)}`;
    const dateChip = canvas.getByRole('button', { name: new RegExp(dateLabel) });

    await userEvent.click(within(durationChip).getByTestId('CancelIcon'));
    await expect(args.onClearDuration).toHaveBeenCalledTimes(1);

    await userEvent.click(within(dateChip).getByTestId('CancelIcon'));
    await expect(args.onClearDateRange).toHaveBeenCalledTimes(1);
  },
};

export const EmptyState: Story = {
  args: {
    filters: {
      minDuration: null,
      maxDuration: null,
      dateFrom: null,
      dateTo: null,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  },
};
