import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import PendingSaveBanner from './PendingSaveBanner';

const meta: Meta<typeof PendingSaveBanner> = {
  title: 'Components/ChannelManager/PendingSaveBanner',
  component: PendingSaveBanner,
  args: {
    show: true,
  },
};

export default meta;
type Story = StoryObj<typeof PendingSaveBanner>;

export const Visible: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText('You have pending changes. Save to apply them.')).toBeInTheDocument();
  },
};
