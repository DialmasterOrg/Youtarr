import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import TitleFilterChip from './TitleFilterChip';

const meta: Meta<typeof TitleFilterChip> = {
  title: 'Atomic/ChannelManager/Chips/TitleFilterChip',
  component: TitleFilterChip,
  args: {
    titleFilterRegex: 'foo.*bar',
    onRegexClick: fn(),
    isMobile: false,
  },
};

export default meta;
type Story = StoryObj<typeof TitleFilterChip>;

export const Default: Story = {};

export const ClickCallsHandler: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByTestId('regex-filter-chip'));

    await expect(args.onRegexClick).toHaveBeenCalled();
    await expect(args.onRegexClick).toHaveBeenCalledWith(expect.anything(), 'foo.*bar');
  },
};
