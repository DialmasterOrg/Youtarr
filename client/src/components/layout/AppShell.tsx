import React, { useEffect, useMemo, useState } from 'react';
import { CssBaseline } from '../ui';
import { SETTINGS_PAGES } from '../Settings/SettingsIndex';
import { useThemeEngine } from '../../contexts/ThemeEngineContext';
import { NavHeader } from './NavHeader';
import { NavSidebar } from './NavSidebar';
import { BackgroundDecorations } from './BackgroundDecorations';
import { NavItem } from './navigation';
import { getThemeById, getThemeLayoutCssVars, resolveThemeLayoutPolicy } from '../../themes';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { HEADER_HEIGHT_DESKTOP, HEADER_HEIGHT_MOBILE, NAV_SIDEBAR_COLLAPSED_WIDTH, NAV_SIDEBAR_EXPANDED_WIDTH } from './navLayoutConstants';
import './layoutFallback.css';

import { Tv as SubscriptionsIcon, Library as VideoLibraryIcon } from 'lucide-react';
import { Download as DownloadIcon, Settings as SettingsIcon } from '../../lib/icons';

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

const APP_BAR_TOGGLE_SIZE = 44;

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
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const { themeMode } = useThemeEngine();
  const isLandscapeMobile = isMobile && isLandscape;
  
  const currentTheme = getThemeById(themeMode);
  const layoutPolicy = resolveThemeLayoutPolicy(currentTheme, isMobile ? 'mobile' : 'desktop');
  const layoutCssVars = getThemeLayoutCssVars(layoutPolicy);
  const isTopNav = layoutPolicy.navPlacement === 'top';

  const [drawerOpenMobile, setDrawerOpenMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const navWidth = isMobile || isTopNav
      ? 0
      : (collapsed ? NAV_SIDEBAR_COLLAPSED_WIDTH : NAV_SIDEBAR_EXPANDED_WIDTH);
    const root = document.documentElement;

    root.style.setProperty('--nav-width', `${navWidth}px`);

    return () => {
      root.style.removeProperty('--nav-width');
    };
  }, [collapsed, isMobile, isTopNav]);

  useEffect(() => {
    const root = document.documentElement;
    const overlayTopOffset = isMobile ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT_DESKTOP;
    root.style.setProperty('--app-shell-overlay-top-offset', `${overlayTopOffset}px`);
    root.style.setProperty('--app-shell-overlay-top-offset-px', String(overlayTopOffset));

    return () => {
      root.style.setProperty('--app-shell-overlay-top-offset', '0px');
      root.style.setProperty('--app-shell-overlay-top-offset-px', '0');
    };
  }, [isMobile]);

  const downloadsSubItems = useMemo(
    () => [
      { key: 'download-manual', label: 'Manual Download', to: '/downloads/manual' },
      { key: 'download-activity', label: 'Activity', to: '/downloads/activity' },
      { key: 'download-history', label: 'History', to: '/downloads/history' },
    ],
    []
  );

  const channelsSubItems = useMemo(
    () => [
      { key: 'channels-list', label: 'Your Channels', to: '/channels' },
      { key: 'channels-subscriptions', label: 'Imports', to: '/channels/imports' },
    ],
    []
  );

  const videosSubItems = useMemo(
    () => [
      { key: 'videos-downloaded', label: 'Downloaded Videos', to: '/videos' },
      { key: 'videos-find', label: 'Find on YouTube', to: '/videos/find' },
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

  const navItems = useMemo<NavItem[]>(
    () =>
      [
        {
          key: 'channels' as const,
          label: 'Channels',
          oldLabel: 'Your Channels',
          icon: <SubscriptionsIcon />,
          to: '/channels',
          subItems: channelsSubItems,
        },
        {
          key: 'videos' as const,
          label: 'Videos',
          oldLabel: 'Downloaded Videos',
          icon: <VideoLibraryIcon />,
          to: '/videos',
          subItems: videosSubItems,
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
    [channelsSubItems, videosSubItems, downloadsSubItems, settingsSubItems]
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
      data-layout-contract-root
      data-testid="layout-contract-root"
      data-layout-breakpoint={layoutPolicy.breakpoint}
      data-nav-placement={layoutPolicy.navPlacement}
      style={{
        ...(layoutCssVars as React.CSSProperties),
        ...(isLandscapeMobile
          ? {
              '--shell-gap': '0px',
              '--layout-main-padding': '104px 0 calc(20px + env(safe-area-inset-bottom))',
              '--layout-content-padding': '0px',
              '--layout-content-frame-radius': '0px',
              '--layout-header-border-radius': '0px',
            }
          : {}),
        display: 'flex',
        gap: isTopNav ? 0 : 'var(--shell-gap)',
        minHeight: '100vh',
        position: 'relative',
        overflowX: 'clip',
        backgroundColor: 'var(--background)',
        background: 'var(--layout-shell-background)',
      }}
    >
      <CssBaseline />

      <BackgroundDecorations decorations={currentTheme.backgroundDecorations} />

      <NavHeader
        appName={appName}
        layoutPolicy={layoutPolicy}
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
        collapsed={collapsed}
        navItems={navItems}
        versionLabel={versionLabel}
      />

      <main
        data-testid="app-shell-main"
        data-layout-breakpoint={layoutPolicy.breakpoint}
        data-nav-placement={layoutPolicy.navPlacement}
        style={
          isTopNav
            ? {
                flexGrow: 1,
              width: '100%',
                marginTop: 'var(--layout-main-margin-top)',
                marginBottom: 0,
                marginRight: 0,
                marginLeft: 0,
                padding: 'var(--layout-main-padding)',
                // On mobile, override bottom padding to clear the fixed bottom nav bar
                paddingBottom: isMobile
                  ? 'calc(var(--mobile-nav-total-offset, 0px) + 16px)'
                  : undefined,
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
                padding: 'var(--layout-main-padding)',
                // On mobile, override bottom padding to clear the fixed bottom nav bar
                paddingBottom: isMobile
                  ? 'calc(var(--mobile-nav-total-offset, 64px) + 16px)'
                  : undefined,
                boxSizing: 'border-box',
                position: 'relative',
                zIndex: 1,
                overflowX: 'clip',
              }
        }
      >
        <div
          data-testid="app-shell-content-frame"
          data-layout-breakpoint={layoutPolicy.breakpoint}
          data-nav-placement={layoutPolicy.navPlacement}
          style={{
            maxWidth: 'var(--layout-content-max-width)',
            marginLeft: 'var(--layout-content-margin-inline)',
            marginRight: 'var(--layout-content-margin-inline)',
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            overflow: 'visible',
            padding: 'var(--layout-content-padding)',
            backgroundColor: 'var(--layout-content-frame-background)',
            border: 'var(--layout-content-frame-border)',
            borderRadius: 'var(--layout-content-frame-radius)',
            boxShadow: 'var(--layout-content-frame-shadow)',
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
