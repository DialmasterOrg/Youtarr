import React, { useEffect, useMemo, useState } from 'react';
import { Box, CssBaseline } from '../ui';
import { SETTINGS_PAGES } from '../Settings/SettingsIndex';
import { useThemeEngine } from '../../contexts/ThemeEngineContext';
import { NavHeader } from './NavHeader';
import { NavSidebar } from './NavSidebar';
import { BackgroundDecorations } from './BackgroundDecorations';
import { getThemeById } from '../../themes';
import { useMediaQuery } from '../../hooks/useMediaQuery';

import { Tv as SubscriptionsIcon, Library as VideoLibraryIcon } from 'lucide-react';
import { Download as DownloadIcon, Settings as SettingsIcon } from '../../lib/icons';

export type AppNavKey = 'channels' | 'videos' | 'downloads' | 'settings';

interface AppShellProps {
  token: string | null;
  isPlatformManaged: boolean;
  appName?: string;
  versionLabel?: string;
  onLogout?: () => void;
  updateAvailable?: boolean;
  updateTooltip?: string;
  ytDlpUpdateAvailable?: boolean;
  ytDlpUpdateTooltip?: string;
  children: React.ReactNode;
}

const EXPANDED_WIDTH = 200;
const COLLAPSED_WIDTH = 65;
const APP_BAR_TOGGLE_SIZE = 44;
const TOP_NAV_DESKTOP_PADDING = '32px 32px 48px';
const TOP_NAV_MOBILE_PADDING = '8px 8px calc(20px + env(safe-area-inset-bottom))';

export function AppShell({
  token,
  isPlatformManaged,
  appName = 'Youtarr',
  versionLabel,
  onLogout,
  updateAvailable = false,
  updateTooltip,
  ytDlpUpdateAvailable = false,
  ytDlpUpdateTooltip,
  children,
}: AppShellProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const { themeMode } = useThemeEngine();
  
  const currentTheme = getThemeById(themeMode);
  const isTopNav = currentTheme.layoutMode === 'top-nav';
  const contentFramePadding = isMobile
    ? themeMode === 'playful'
      ? '12px 6px'
      : '12px 8px'
    : themeMode === 'playful'
      ? '20px 16px'
      : '24px 32px';

  const [drawerOpenMobile, setDrawerOpenMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const navWidth = isMobile || isTopNav ? 0 : (collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH);
    document.documentElement.style.setProperty('--nav-width', `${navWidth}px`);
  }, [collapsed, isMobile, isTopNav]);

  const downloadsSubItems = useMemo(
    () => [
      { key: 'download-manual', label: 'Manual Download', to: '/downloads/manual' },
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
          oldLabel: 'Manage Downloads',
          icon: <DownloadIcon />,
          to: '/downloads',
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
    <div
      style={{
        display: 'flex',
        gap: isTopNav ? 0 : 'var(--shell-gap)',
        minHeight: '100vh',
        position: 'relative',
        overflowX: 'clip',
        backgroundColor: 'var(--background)',
        background: themeMode === 'linear'
          ? '#050506'
          : 'linear-gradient(180deg, var(--card) 0%, var(--background) 55%, var(--background) 100%)',
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
        ytDlpUpdateAvailable={ytDlpUpdateAvailable}
        ytDlpUpdateTooltip={ytDlpUpdateTooltip}
        onLogout={onLogout}
        toggleDrawer={toggleDrawer}
        APP_BAR_TOGGLE_SIZE={APP_BAR_TOGGLE_SIZE}
        isCollapsed={isMobile || isTopNav ? !drawerOpenMobile : collapsed}
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

      <main
        style={
          isTopNav
            ? {
                flexGrow: 1,
                width: '100vw',
                marginTop: 64,
                marginBottom: 0,
                marginRight: 0,
                marginLeft: 0,
                padding: isMobile ? TOP_NAV_MOBILE_PADDING : TOP_NAV_DESKTOP_PADDING,
                position: 'relative',
                zIndex: 1,
                transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                minHeight: 0,
                background: 'none',
                backdropFilter: 'none',
                borderRadius: 0,
                boxSizing: 'border-box',
                overflowX: 'clip',
              }
            : {
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                minWidth: 0,
                paddingTop: isMobile ? 'calc(64px + var(--shell-gap) * 2)' : 'calc(80px + var(--shell-gap))',
                paddingBottom: 'var(--shell-gap)',
                paddingLeft: isMobile ? 'var(--shell-gap)' : 'calc(var(--nav-width) + var(--shell-gap) * 2)',
                paddingRight: 'var(--shell-gap)',
                boxSizing: 'border-box',
                position: 'relative',
                zIndex: 1,
                overflowX: 'clip',
              }
        }
      >
        <div
          style={{
            maxWidth: themeMode === 'playful' ? 'none' : 1400,
            marginLeft: themeMode === 'playful' ? 0 : 'auto',
            marginRight: themeMode === 'playful' ? 0 : 'auto',
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            overflowX: 'hidden',
            padding: contentFramePadding,
            ...(themeMode === 'playful'
              ? {
                  backgroundColor: 'var(--card)',
                  border: '2px solid var(--foreground)',
                  borderRadius: 'var(--radius-ui)',
                  boxShadow: 'var(--shadow-soft)',
                }
              : {}),
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
