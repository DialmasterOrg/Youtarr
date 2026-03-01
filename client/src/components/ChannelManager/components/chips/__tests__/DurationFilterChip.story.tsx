import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import DurationFilterChip from '../DurationFilterChip';

const meta: Meta<typeof DurationFilterChip> = {
  title: 'Atomic/ChannelManager/Chips/DurationFilterChip',
  component: DurationFilterChip,
  args: {
    minDuration: 10 * 60,
    maxDuration: 30 * 60,
    isMobile: false,
  },
};

export default meta;
type Story = StoryObj<typeof DurationFilterChip>;

export const Range: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Chip label is rendered as text
    await expect(canvas.getByText('10-30m')).toBeInTheDocument();
  },
};

export const MinimumOnly: Story = {
  args: {
    minDuration: 15 * 60,
    maxDuration: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('≥15m')).toBeInTheDocument();
  },
};

export const MaximumOnly: Story = {
  args: {
    minDuration: null,
    maxDuration: 5 * 60,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('≤5m')).toBeInTheDocument();
  },
};
