import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import StillLiveDot from './StillLiveDot';

const meta: Meta<typeof StillLiveDot> = {
  title: 'ChannelPage/StillLiveDot',
  component: StillLiveDot,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    isMobile: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof StillLiveDot>;

export const Desktop: Story = {
  args: { isMobile: false },
};

export const Mobile: Story = {
  args: {
    isMobile: true,
    onMobileClick: (msg) => alert(msg),
  },
};

export const InContext: Story = {
  render: () => (
    <div className="flex items-center gap-2 p-3 bg-card rounded-lg border border-border">
      <span className="text-sm font-medium">Super Bowl LVIII – Live Coverage</span>
      <StillLiveDot />
    </div>
  ),
};
