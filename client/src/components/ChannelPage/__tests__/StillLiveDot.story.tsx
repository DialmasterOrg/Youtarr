import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import StillLiveDot from '../StillLiveDot';

const meta: Meta<typeof StillLiveDot> = {
  title: 'Components/ChannelPage/StillLiveDot',
  component: StillLiveDot,
  args: {
    isMobile: false,
  },
};

export default meta;
type Story = StoryObj<typeof StillLiveDot>;

export const ShowsTooltip: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByText('LIVE');
    await userEvent.click(chip);

    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('Cannot download while still airing')).toBeInTheDocument();
  },
};
