import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { NavHeader } from '../NavHeader';
import { getThemeById, resolveThemeLayoutPolicy } from '../../../themes';

const navItems = [
  { key: 'channels', label: 'Channels', oldLabel: 'Your Channels', icon: <span>C</span>, to: '/channels' },
  { key: 'settings', label: 'Settings', oldLabel: 'Configuration', icon: <span>S</span>, to: '/settings' },
];

const meta: Meta<typeof NavHeader> = {
  title: 'Layout/Test/NavHeader',
  component: NavHeader,
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
    token: null,
    isPlatformManaged: false,
    versionLabel: 'v1.60.0 • yt-dlp: 2026.03.01',
    updateAvailable: false,
    updateTooltip: undefined,
    ytDlpUpdateAvailable: false,
    ytDlpUpdateTooltip: undefined,
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
      await expect(canvas.getByRole('link', { name: 'Youtarr' })).toBeInTheDocument();

      const header = canvasElement.querySelector('[data-nav-container]') as HTMLElement;
      await expect(header.dataset.layoutBreakpoint).toBe(breakpoint);
      await expect(header.dataset.navPlacement).toBe(policy.navPlacement);
      await expect(header.style.getPropertyValue('--layout-header-title-inset')).toBe(policy.headerTitleInset);

      if (breakpoint === 'mobile' || policy.navPlacement === 'sidebar') {
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