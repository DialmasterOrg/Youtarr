import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { SettingsIndex } from './SettingsIndex';

const meta: Meta<typeof SettingsIndex> = {
  title: 'Pages/Settings/SettingsIndex',
  component: SettingsIndex,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SettingsIndex>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();

    const link = canvas.getByRole('link', { name: /core/i });
    await expect(link).toHaveAttribute('href', '/settings/core');
    await userEvent.click(link);
  },
};
