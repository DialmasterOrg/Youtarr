import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { InfoTooltip } from './InfoTooltip';

const meta: Meta<typeof InfoTooltip> = {
  title: 'Components/Configuration/InfoTooltip',
  component: InfoTooltip,
  args: {
    text: 'Tooltip details',
    onMobileClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof InfoTooltip>;

export const DesktopHover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await userEvent.hover(button);

    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('Tooltip details')).toBeInTheDocument();
  },
};
