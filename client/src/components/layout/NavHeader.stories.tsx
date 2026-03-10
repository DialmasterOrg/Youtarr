import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { NavHeader } from './NavHeader';
import { getThemeById, resolveThemeLayoutPolicy } from '../../themes';

const navItems = [
  { key: 'channels', label: 'Channels', oldLabel: 'Your Channels', icon: <span>C</span>, to: '/channels' },
  {
    key: 'downloads',
    label: 'Downloads',
    oldLabel: 'Manage Downloads',
    icon: <span>D</span>,
    to: '/downloads',
    subItems: [
      { key: 'manual', label: 'Manual Download', to: '/downloads/manual' },
      { key: 'activity', label: 'Activity', to: '/downloads/activity' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    oldLabel: 'Configuration',
    icon: <span>S</span>,
    to: '/settings',
  },
];

const meta: Meta<typeof NavHeader> = {
  title: 'Layout/NavHeader',
  component: NavHeader,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/channels']}>
        <div className="min-h-[140px] bg-background px-4 py-6">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  args: {
    appName: 'Youtarr',
    layoutPolicy: resolveThemeLayoutPolicy(getThemeById('linear'), 'desktop'),
    navItems,
    token: 'storybook-token',
    isPlatformManaged: false,
    versionLabel: 'v1.60.0 • yt-dlp: 2026.03.01',
    updateAvailable: true,
    updateTooltip: 'New version available.',
    ytDlpUpdateAvailable: true,
    ytDlpUpdateTooltip: 'yt-dlp update available in Settings.',
    onLogout: () => {},
    toggleDrawer: () => {},
    APP_BAR_TOGGLE_SIZE: 44,
    isCollapsed: false,
  },
};

export default meta;
type Story = StoryObj<typeof NavHeader>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('link', { name: 'Youtarr' })).toBeInTheDocument();

    const updateButton = canvas.getByRole('button', { name: /youtarr and yt-dlp updates available/i });
    await userEvent.hover(updateButton);
    await expect(await within(canvasElement.ownerDocument.body).findByRole('tooltip')).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  args: {
    layoutPolicy: resolveThemeLayoutPolicy(getThemeById('linear'), 'mobile'),
  },
};

export const PlayfulTheme: Story = {
  args: {
    layoutPolicy: resolveThemeLayoutPolicy(getThemeById('playful'), 'desktop'),
  },
  globals: {
    themeMode: 'playful',
    motionEnabled: 'on',
  },
};