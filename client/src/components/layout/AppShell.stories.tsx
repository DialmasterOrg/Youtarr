import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from './AppShell';

const meta: Meta<typeof AppShell> = {
  title: 'Layout/AppShell',
  component: AppShell,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/subscriptions']}>
        <Story />
      </MemoryRouter>
    ),
  ],
  args: {
    token: 'storybook-token',
    isPlatformManaged: false,
    appName: 'Youtarr',
    versionLabel: 'v1.60.0 • yt-dlp: 2026.03.01',
    updateAvailable: true,
    updateTooltip: 'New Youtarr release available.',
    ytDlpUpdateAvailable: true,
    ytDlpUpdateTooltip: 'yt-dlp update available in Settings.',
    onLogout: () => {},
    children: (
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Channels Workspace</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Storybook shell coverage for the Tailwind layout, navigation chrome, and themed page container.
        </p>
      </section>
    ),
  },
};

export default meta;
type Story = StoryObj<typeof AppShell>;

export const DesktopLinear: Story = {
  globals: {
    themeMode: 'linear',
    colorMode: 'dark',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Channels Workspace')).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: /channels/i })).toBeInTheDocument();
  },
};

export const PlayfulExpanded: Story = {
  globals: {
    themeMode: 'playful',
    colorMode: 'light',
    motionEnabled: 'on',
  },
};

export const TopNavFlat: Story = {
  globals: {
    themeMode: 'flat',
    colorMode: 'light',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: /toggle navigation/i })).not.toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: /settings/i })).toBeInTheDocument();
  },
};