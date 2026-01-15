import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import { ConfigurationCard } from './ConfigurationCard';

const meta: Meta<typeof ConfigurationCard> = {
  title: 'Components/Configuration/ConfigurationCard',
  component: ConfigurationCard,
  args: {
    title: 'Card Title',
    subtitle: 'Card subtitle text',
    children: 'Card body content',
  },
};

export default meta;
type Story = StoryObj<typeof ConfigurationCard>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Card Title')).toBeInTheDocument();
    await expect(canvas.getByText('Card subtitle text')).toBeInTheDocument();
    await expect(canvas.getByText('Card body content')).toBeInTheDocument();
  },
};
