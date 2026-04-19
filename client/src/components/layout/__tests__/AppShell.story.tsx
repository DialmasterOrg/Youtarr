import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../AppShell';

const meta: Meta<typeof AppShell> = {
  title: 'Layout/Test/AppShell',
  component: AppShell,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/channels']}>
        <Story />
      </MemoryRouter>
    ),
  ],
  args: {
    token: null,
    isPlatformManaged: false,
    appName: 'Youtarr',
    versionLabel: 'v1.60.0 • yt-dlp: 2026.03.01',
    updateAvailable: false,
    updateTooltip: undefined,
    ytDlpUpdateAvailable: false,
    ytDlpUpdateTooltip: undefined,
    onLogout: () => {},
    children: <div>Shell content</div>,
  },
};

export default meta;
type Story = StoryObj<typeof AppShell>;

function makeStory(themeMode: 'playful' | 'linear' | 'flat', layoutBreakpoint: 'mobile' | 'desktop'): Story {
  const expectedNavPlacement = themeMode === 'playful' ? 'sidebar' : 'top';
  const expectedContentPadding = themeMode === 'playful'
    ? layoutBreakpoint === 'mobile' ? '8px 3px' : '5px 4px'
    : layoutBreakpoint === 'mobile' ? '8px 4px' : '12px 16px';

  return {
    parameters: {
      layoutBreakpoint,
    },
    globals: {
      themeMode,
      colorMode: themeMode === 'linear' ? 'dark' : 'light',
      motionEnabled: themeMode === 'playful' ? 'on' : 'off',
    },
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByText('Shell content')).toBeInTheDocument();

      const root = canvasElement.querySelector('[data-layout-contract-root]') as HTMLElement;
      const frame = canvasElement.querySelector('[data-testid="app-shell-content-frame"]') as HTMLElement;
      const main = canvasElement.querySelector('[data-testid="app-shell-main"]') as HTMLElement;

      await expect(root.dataset.layoutBreakpoint).toBe(layoutBreakpoint);
      await expect(root.dataset.navPlacement).toBe(expectedNavPlacement);
      await expect(root.style.getPropertyValue('--layout-content-padding')).toBe(expectedContentPadding);
      await expect(frame.dataset.layoutBreakpoint).toBe(layoutBreakpoint);
      await expect(main.dataset.navPlacement).toBe(expectedNavPlacement);
    },
  };
}

export const PlayfulDesktop = makeStory('playful', 'desktop');
export const PlayfulMobile = makeStory('playful', 'mobile');
export const LinearDesktop = makeStory('linear', 'desktop');
export const LinearMobile = makeStory('linear', 'mobile');
export const FlatDesktop = makeStory('flat', 'desktop');
export const FlatMobile = makeStory('flat', 'mobile');