import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  CssBaseline,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { SETTINGS_PAGES } from '../Settings/SettingsIndex';
import { useThemeEngine } from '../../contexts/ThemeEngineContext';
import { NavHeader } from './NavHeader';
import { NavSidebar } from './NavSidebar';
import { BackgroundDecorations } from './BackgroundDecorations';
import { getThemeById } from '../../themes';

import SubscriptionsIcon from '@mui/icons-material/Subscriptions';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import DownloadIcon from '@mui/icons-material/Download';
import SettingsIcon from '@mui/icons-material/Settings';

export type AppNavKey = 'channels' | 'videos' | 'downloads' | 'settings';

interface AppShellProps {
  token: string | null;
  isPlatformManaged: boolean;
  appName?: string;
  versionLabel?: string;
  onLogout?: () => void;
  updateAvailable?: boolean;
  updateTooltip?: string;
  children: React.ReactNode;
}

const EXPANDED_WIDTH = 200;
const COLLAPSED_WIDTH = 65;
const APP_BAR_TOGGLE_SIZE = 44;

export function AppShell({
  token,
  isPlatformManaged,
  appName = 'Youtarr',
  versionLabel,
  onLogout,
  updateAvailable = false,
  updateTooltip,
  children,
}: AppShellProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const { themeMode } = useThemeEngine();
  
  const currentTheme = getThemeById(themeMode);
  const isTopNav = currentTheme.layoutMode === 'top-nav';

  const [drawerOpenMobile, setDrawerOpenMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const navWidth = isMobile || isTopNav ? 0 : (collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH);
    document.documentElement.style.setProperty('--nav-width', `${navWidth}px`);
  }, [collapsed, isMobile, isTopNav]);

  const downloadsSubItems = useMemo(
    () => [
      { key: 'download-manual', label: 'Manual Download', to: '/downloads/manual' },
      { key: 'download-channel', label: 'Channel Download', to: '/downloads/channel' },
      { key: 'download-activity', label: 'Activity', to: '/downloads/activity' },
      { key: 'download-history', label: 'History', to: '/downloads/history' },
    ],
    []
  );

  const settingsSubItems = useMemo(
    () =>
      SETTINGS_PAGES.map((page) => ({
        key: page.key,
        label: page.title,
        to: `/settings/${page.key}`,
      })),
    []
  );

  const navItems = useMemo(
    () =>
      [
        {
          key: 'channels' as const,
          label: 'Channels',
          oldLabel: 'Your Channels',
          icon: <SubscriptionsIcon />,
          to: '/channels',
        },
        {
          key: 'videos' as const,
          label: 'Videos',
          oldLabel: 'Downloaded Videos',
          icon: <VideoLibraryIcon />,
          to: '/videos',
        },
        {
          key: 'downloads' as const,
          label: 'Downloads',
          oldLabel: 'Manage Video Downloads',
          icon: <DownloadIcon />,
          to: '/downloads/manual',
          subItems: downloadsSubItems,
        },
        {
          key: 'settings' as const,
          label: 'Settings',
          oldLabel: 'Configuration',
          icon: <SettingsIcon />,
          to: '/settings',
          subItems: settingsSubItems,
        },
      ],
    [downloadsSubItems, settingsSubItems]
  );

  const toggleDrawer = () => {
    if (isMobile || isTopNav) {
      setDrawerOpenMobile((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        gap: isTopNav ? 0 : 'var(--shell-gap)',
        minHeight: '100vh',
        position: 'relative',
        bgcolor: 'background.default',
        background: themeMode === 'linear'
          ? '#050506'
          : `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 55%, ${theme.palette.background.default} 100%)`,
      }}
    >
      <CssBaseline />

      <BackgroundDecorations themeMode={themeMode} />

      <NavHeader
        appName={appName}
        isMobile={isMobile}
        themeMode={themeMode}
        navItems={navItems}
        token={token}
        isPlatformManaged={isPlatformManaged}
        versionLabel={versionLabel}
        updateAvailable={updateAvailable}
        updateTooltip={updateTooltip}
        onLogout={onLogout}
        toggleDrawer={toggleDrawer}
        APP_BAR_TOGGLE_SIZE={APP_BAR_TOGGLE_SIZE}
      />

      <NavSidebar
        token={token}
        isMobile={isMobile}
        isTopNav={isTopNav}
        drawerOpenMobile={drawerOpenMobile}
        collapsed={collapsed}
        navItems={navItems}
        versionLabel={versionLabel}
        onCloseMobile={() => setDrawerOpenMobile(false)}
      />

      <Box
        component="main"
        sx={
          isTopNav
            ? {
                flexGrow: 1,
                width: { xs: '100vw', md: '100vw' },
                mt: '64px',
                mb: 0,
                mr: 0,
                ml: 0,
                px: { xs: 2, sm: 3, md: 4 },
                pb: 6,
                pt: 4,
                position: 'relative',
                zIndex: 1,
                transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                minHeight: 0,
                background: themeMode === 'neumorphic' ? 'rgba(255, 255, 255, 0.5)' : 'none',
                backdropFilter: themeMode === 'neumorphic' ? 'blur(10px)' : 'none',
                borderRadius: 0,
              }
            : {
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                minWidth: 0,
              pt: isMobile ? 'calc(60px + var(--shell-gap))' : 'calc(80px + var(--shell-gap))',
                pb: 'var(--shell-gap)',
                px: 'var(--shell-gap)',
                boxSizing: 'border-box',
                position: 'relative',
                zIndex: 1,
              }
        }
      >
        {themeMode === 'playful' ? (
          <Box
            sx={{
              bgcolor: 'background.paper',
              border: '2px solid var(--foreground)',
              borderRadius: 'var(--radius-ui)',
              boxShadow: 'var(--shadow-soft)',
              px: 2,
              py: { xs: 2.5, md: 3 },
              width: '100%',
            }}
          >
            <Box sx={{ maxWidth: 1400, mx: 'auto' }}>{children}</Box>
          </Box>
        ) : (
          <Box sx={{ maxWidth: 1400, mx: 'auto' }}>{children}</Box>
        )}
      </Box>
    </Box>
  );
}
