import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import React, { useState } from 'react';
import { Button } from '@mui/material';
import FilterMenu from '../FilterMenu';

const meta: Meta<typeof FilterMenu> = {
  title: 'Components/VideosPage/FilterMenu',
  component: FilterMenu,
  args: {
    filter: '',
    uniqueChannels: ['Tech Channel', 'Gaming Channel'],
    handleMenuItemClick: fn(),
  },
  render: (args) => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    return (
      <>
        <Button onClick={(e) => setAnchorEl(e.currentTarget)}>Open Menu</Button>
        <FilterMenu
          {...args}
          anchorEl={anchorEl}
          handleClose={() => setAnchorEl(null)}
        />
      </>
    );
  },
};

export default meta;
type Story = StoryObj<typeof FilterMenu>;

export const SelectChannel: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Open Menu' }));

    const body = within(canvasElement.ownerDocument.body);
    const channelItem = await body.findByText('Tech Channel');
    await userEvent.click(channelItem);

    await expect(args.handleMenuItemClick).toHaveBeenCalled();
  },
};
