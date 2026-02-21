import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import ConfigurationSkeleton from '../ConfigurationSkeleton';

const meta: Meta<typeof ConfigurationSkeleton> = {
  title: 'Components/Configuration/ConfigurationSkeleton',
  component: ConfigurationSkeleton,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof ConfigurationSkeleton>;

export const Loading: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Loading configuration...')).toBeInTheDocument();
  },
};
