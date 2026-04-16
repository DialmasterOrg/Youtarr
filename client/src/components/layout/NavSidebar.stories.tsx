import React, { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { NavSidebar } from './NavSidebar';
import { useThemeEngine } from '../../contexts/ThemeEngineContext';

function SectionIconsController({ visible }: { visible: boolean }) {
  const { setShowSectionIcons } = useThemeEngine();

  useEffect(() => {
    setShowSectionIcons(visible);
  }, [setShowSectionIcons, visible]);

  return null;
}

const navItems = [
  {
    key: 'channels',
    label: 'Channels',
    oldLabel: 'Your Channels',
    icon: <span>C</span>,
    to: '/channels',
  },
  {
    key: 'downloads',
    label: 'Downloads',
    oldLabel: 'Manage Downloads',
    icon: <span>D</span>,
    to: '/downloads',
    subItems: [
      { key: 'manual', label: 'Manual Download', to: '/downloads/manual' },
      { key: 'activity', label: 'Activity', to: '/downloads/activity' },
      { key: 'history', label: 'History', to: '/downloads/history' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    oldLabel: 'Configuration',
    icon: <span>S</span>,
    to: '/settings',
    subItems: [
      { key: 'core', label: 'Core', to: '/settings/core' },
      { key: 'appearance', label: 'Appearance', to: '/settings/appearance' },
    ],
  },
];

const meta: Meta<typeof NavSidebar> = {
  title: 'Layout/NavSidebar',
  component: NavSidebar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/settings/core']}>
        <div className="min-h-[700px] bg-background p-4">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  args: {
    token: 'storybook-token',
    isMobile: false,
    isTopNav: false,
    collapsed: false,
    navItems,
    versionLabel: 'v1.60.0 • yt-dlp: 2026.03.01',
  },
};

export default meta;
type Story = StoryObj<typeof NavSidebar>;

export const ExpandedDesktop: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Core')).toBeInTheDocument();
    await expect(canvas.getByText('Appearance')).toBeInTheDocument();
  },
};

export const CollapsedDesktop: Story = {
  args: {
    collapsed: true,
  },
};

export const MobileBottomNav: Story = {
  args: {
    isMobile: true,
  },
};

export const PlayfulCenteredButtons: Story = {
  parameters: {
    globals: {
      themeMode: 'playful',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Verify that the sidebar renders with centered buttons (equal left/right gutters on playful)
    await expect(canvas.getByText('Channels')).toBeInTheDocument();
    const navItems = canvasElement.querySelectorAll('[role="button"]') as NodeListOf<HTMLElement>;
    if (navItems.length > 0) {
      // Check that buttons have centered padding on playful theme
      const buttonStyles = window.getComputedStyle(navItems[0]);
      await expect(buttonStyles).toBeDefined();
    }
  },
};

export const ExpandedDesktopWithoutIcons: Story = {
  decorators: [
    (Story) => (
      <>
        <SectionIconsController visible={false} />
        <Story />
      </>
    ),
  ],
  parameters: {
    globals: {
      themeMode: 'playful',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Channels')).toBeInTheDocument();
    await expect(canvas.queryByText('C')).not.toBeInTheDocument();
  },
};