import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import SubFolderChip from './SubFolderChip';
import { GLOBAL_DEFAULT_SENTINEL } from 'src/utils/channelHelpers';

const meta: Meta<typeof SubFolderChip> = {
  title: 'Atomic/ChannelManager/Chips/SubFolderChip',
  component: SubFolderChip,
  args: {
    subFolder: 'Movies',
  },
};

export default meta;
type Story = StoryObj<typeof SubFolderChip>;

export const SpecificSubfolder: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByTestId('subfolder-chip');
    await expect(chip).toHaveAttribute('data-default', 'false');
    await expect(canvas.getByText('__Movies/')).toBeInTheDocument();
  },
};

export const Root: Story = {
  args: {
    subFolder: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByTestId('subfolder-chip');
    await expect(chip).toHaveAttribute('data-root', 'true');
    await expect(canvas.getByText('root')).toBeInTheDocument();
  },
};

export const GlobalDefault: Story = {
  args: {
    subFolder: GLOBAL_DEFAULT_SENTINEL,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByTestId('subfolder-chip');
    await expect(chip).toHaveAttribute('data-default', 'true');
    await expect(canvas.getByText('global default')).toBeInTheDocument();
  },
};
