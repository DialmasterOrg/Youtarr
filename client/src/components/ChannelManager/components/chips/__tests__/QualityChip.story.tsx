import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import QualityChip from '../QualityChip';

const meta: Meta<typeof QualityChip> = {
  title: 'Atomic/ChannelManager/Chips/QualityChip',
  component: QualityChip,
  args: {
    globalPreferredResolution: '1080',
    videoQuality: undefined,
  },
};

export default meta;
type Story = StoryObj<typeof QualityChip>;

export const UsesGlobalDefault: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByTestId('quality-chip');
    await expect(chip).toHaveAttribute('data-override', 'false');
  },
};

export const OverrideQuality: Story = {
  args: {
    videoQuality: '720',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByTestId('quality-chip');
    await expect(chip).toHaveAttribute('data-override', 'true');
  },
};
