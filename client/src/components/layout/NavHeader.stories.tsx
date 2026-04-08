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

function makeStory(themeMode: 'playful' | 'linear' | 'flat', breakpoint: 'mobile' | 'desktop'): Story {
  const policy = resolveThemeLayoutPolicy(getThemeById(themeMode), breakpoint);

  return {
    args: {
      layoutPolicy: policy,
    },
    globals: {
      themeMode,
      colorMode: themeMode === 'linear' ? 'dark' : 'light',
      motionEnabled: themeMode === 'playful' ? 'on' : 'off',
    },
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement);
      const expectedLinkName = themeMode === 'playful' ? 'Youtarr' : /youtarr logo youtarr/i;
      await expect(canvas.getByRole('link', { name: expectedLinkName })).toBeInTheDocument();

      const header = canvasElement.querySelector('[data-nav-container]') as HTMLElement;
      await expect(header.dataset.layoutBreakpoint).toBe(breakpoint);
      await expect(header.dataset.navPlacement).toBe(policy.navPlacement);
      await expect(header.style.getPropertyValue('--layout-header-title-inset')).toBe(policy.headerTitleInset);

      const isTopNav = policy.navPlacement === 'top';
      const isMobileBreakpoint = breakpoint === 'mobile';
      const showsToggle = (!isMobileBreakpoint && !isTopNav) || (isMobileBreakpoint && policy.showHeaderToggleOnMobile);
      if (showsToggle) {
        await expect(canvas.getByRole('button', { name: /toggle navigation/i })).toBeInTheDocument();
      } else {
        await expect(canvas.queryByRole('button', { name: /toggle navigation/i })).not.toBeInTheDocument();
      }
    },
  };
}

export const PlayfulDesktop = makeStory('playful', 'desktop');
export const PlayfulMobile = makeStory('playful', 'mobile');
export const LinearDesktop = makeStory('linear', 'desktop');
export const LinearMobile = makeStory('linear', 'mobile');
export const FlatDesktop = makeStory('flat', 'desktop');
export const FlatMobile = makeStory('flat', 'mobile');
