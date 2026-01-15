import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import StorageStatus from './StorageStatus';

const meta: Meta<typeof StorageStatus> = {
  title: 'Composite/StorageStatus',
  component: StorageStatus,
  args: {
    token: 'storybook-token',
  },
};

export default meta;
type Story = StoryObj<typeof StorageStatus>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/gb free/i)).toBeInTheDocument();
  },
};
