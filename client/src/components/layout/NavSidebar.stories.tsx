import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import React, { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import SubscriptionsIcon from '@mui/icons-material/Subscriptions';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import DownloadIcon from '@mui/icons-material/Download';
import SettingsIcon from '@mui/icons-material/Settings';
import { ThemeEngineProvider, useThemeEngine } from '../../contexts/ThemeEngineContext';
import { NavSidebar } from './NavSidebar';

const navItems = [
  {
    key: 'channels',
    label: 'Channels',
    icon: <SubscriptionsIcon />,
    to: '/channels',
  },
  {
    key: 'videos',
    label: 'Videos',
    icon: <VideoLibraryIcon />,
    to: '/videos',
  },
  {
    key: 'downloads',
    label: 'Downloads',
    icon: <DownloadIcon />,
    to: '/downloads/manual',
    subItems: [
      { key: 'download-manual', label: 'Manual Download', to: '/downloads/manual' },
      { key: 'download-channel', label: 'Channel Download', to: '/downloads/channel' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: <SettingsIcon />,
    to: '/settings',
  },
];

const ThemeSetter = ({ initialTheme, children }: { initialTheme: 'playful' | 'linear'; children: React.ReactNode }) => {
  const { setThemeMode } = useThemeEngine();

  useEffect(() => {
    setThemeMode(initialTheme);
  }, [initialTheme, setThemeMode]);

  return <>{children}</>;
};

const meta: Meta<typeof NavSidebar> = {
  title: 'Components/Layout/NavSidebar',
  component: NavSidebar,
  args: {
    isMobile: true,
    isTopNav: false,
    drawerOpenMobile: true,
    collapsed: false,
    navItems,
    token: null,
    onCloseMobile: () => undefined,
  },
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
  },
};

export default meta;

type Story = StoryObj<typeof NavSidebar>;

export const PlayfulBottomBar: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/channels']}>
        <ThemeEngineProvider>
          <ThemeSetter initialTheme="playful">
            <Story />
          </ThemeSetter>
        </ThemeEngineProvider>
      </MemoryRouter>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Channels')).toBeInTheDocument();
  },
};

export const LinearMobileDrawer: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/downloads/manual']}>
        <ThemeEngineProvider>
          <ThemeSetter initialTheme="linear">
            <Story />
          </ThemeSetter>
        </ThemeEngineProvider>
      </MemoryRouter>
    ),
  ],
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const downloadsItem = await body.findByRole('link', { name: /downloads/i, hidden: true });
    await userEvent.click(downloadsItem);
    await expect(body.getByText('Manual Download')).toBeInTheDocument();
  },
};
