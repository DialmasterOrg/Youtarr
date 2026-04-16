import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import SelectionActionFab from './SelectionActionFab';

const meta: Meta<typeof SelectionActionFab> = {
  title: 'ChannelPage/SelectionActionFab',
  component: SelectionActionFab,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    count: 3,
    intent: 'download',
    menuOpen: false,
    onClick: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof SelectionActionFab>;

export const DownloadIntent: Story = {};

export const DeleteIntent: Story = {
  args: { intent: 'delete' },
};

export const MenuOpen: Story = {
  args: { menuOpen: true },
};

export const HighCount: Story = {
  args: { count: 100 },
};

export const SingleVideo: Story = {
  args: { count: 1 },
};
