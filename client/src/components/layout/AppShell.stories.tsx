import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from './AppShell';

const meta: Meta<typeof AppShell> = {
  title: 'Layout/AppShell',
  component: AppShell,
  args: {
    token: 'storybook-token',
    isPlatformManaged: false,
    appName: 'Youtarr',
    versionLabel: 'v0.0.0-storybook',
    onLogout: fn(),
  },
  render: (args) => (
    <MemoryRouter>
      <AppShell {...args}>
        <div>Page content</div>
      </AppShell>
    </MemoryRouter>
  ),
};

export default meta;
type Story = StoryObj<typeof AppShell>;

export const Default: Story = {};

export const Logout: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /logout/i }));
    await expect(args.onLogout).toHaveBeenCalled();
  },
};
