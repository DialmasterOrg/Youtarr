import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { ConfigurationAccordion } from './ConfigurationAccordion';

const meta: Meta<typeof ConfigurationAccordion> = {
  title: 'Components/Configuration/ConfigurationAccordion',
  component: ConfigurationAccordion,
  args: {
    title: 'Accordion Title',
    chipLabel: 'Enabled',
    chipColor: 'success',
    defaultExpanded: true,
    children: 'Accordion content goes here',
  },
};

export default meta;
type Story = StoryObj<typeof ConfigurationAccordion>;

export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Accordion Title')).toBeInTheDocument();
    await expect(canvas.getByText('Enabled')).toBeInTheDocument();
    await expect(canvas.getByText('Accordion content goes here')).toBeInTheDocument();

    await userEvent.click(canvas.getByText('Accordion Title'));
    await expect(canvas.queryByText('Accordion content goes here')).not.toBeVisible();
  },
};
