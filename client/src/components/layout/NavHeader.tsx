import React from 'react';
import {
  Box,
  Typography,
  IconButton,
} from '../ui';
import { Link as RouterLink } from 'react-router-dom';
import {
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '../../lib/icons';
import { getThemeById, getThemeLayoutCssVars, ThemeLayoutPolicy } from '../../themes';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useThemeEngine } from '../../contexts/ThemeEngineContext';
import { NavHeaderActions } from './NavHeaderActions';
import { NavHeaderTopItems } from './NavHeaderTopItems';
import { HEADER_HEIGHT_DESKTOP, NAV_DRAWER_SECTION_BUTTON_GUTTER } from './navLayoutConstants';
import { NavItem } from './navigation';
import youtarrWordmark from '../../Youtarr_text.png';
import './layoutFallback.css';

interface NavHeaderProps {
  appName: string;
  layoutPolicy: ThemeLayoutPolicy;
  navItems: NavItem[];
  token: string | null;
  isPlatformManaged: boolean;
  versionLabel?: string;
  updateAvailable: boolean;
  updateTooltip?: string;
  ytDlpUpdateAvailable?: boolean;
  ytDlpUpdateTooltip?: string;
  onLogout?: () => void;
  toggleDrawer: () => void;
  APP_BAR_TOGGLE_SIZE: number;
  isCollapsed: boolean;
}

export const NavHeader: React.FC<NavHeaderProps> = ({
  appName,
  layoutPolicy,
  navItems,
  token,
  isPlatformManaged,
  versionLabel,
  updateAvailable,
  updateTooltip,
  ytDlpUpdateAvailable = false,
  ytDlpUpdateTooltip,
  onLogout,
  toggleDrawer,
  APP_BAR_TOGGLE_SIZE,
  isCollapsed,
}) => {
  const layoutCssVars = getThemeLayoutCssVars(layoutPolicy);
  const { themeMode, showHeaderLogo, showHeaderWordmark } = useThemeEngine();
  const currentTheme = getThemeById(themeMode);

  const isMobile = layoutPolicy.breakpoint === 'mobile';
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isTopNav = layoutPolicy.navPlacement === 'top';
  const isInsetFrame = layoutPolicy.headerFrameMode === 'inset';
  const showLandscapeNavItems = isMobile && isLandscape;
  const usesInsetFrame = isInsetFrame && !showLandscapeNavItems;

  const showTopNavItems = (layoutPolicy.showDesktopNavItems && !isMobile) || showLandscapeNavItems;

  const headerHorizontalGutter = NAV_DRAWER_SECTION_BUTTON_GUTTER;
  const headerHorizontalPadding = isMobile
    ? currentTheme.headerBehavior.mobileHorizontalPadding
    : `${headerHorizontalGutter}px`;
  const headerInsetOffset = isMobile
    ? currentTheme.headerBehavior.mobileInsetOffset
    : 'var(--shell-gap)';

  const menuPaperStyle: React.CSSProperties = {
    overflowX: 'hidden',
    overflowY: 'auto',
    maxHeight: `calc(100dvh - ${HEADER_HEIGHT_DESKTOP}px)`,
    width: 'max-content',
    minWidth: 180,
    borderRadius: 'var(--layout-header-menu-radius)',
    border: 'var(--layout-header-menu-border)',
    backgroundColor: 'var(--layout-header-menu-background)',
    boxShadow: 'var(--layout-header-menu-shadow)',
    padding: '4px',
  };

  const headerStyle: React.CSSProperties = {
    position: 'fixed',
    backgroundColor: 'var(--layout-header-background)',
    backdropFilter: 'var(--layout-header-backdrop-filter)',
    border: 'var(--layout-header-border)',
    borderBottom: 'var(--layout-header-border-bottom)',
    borderTop: usesInsetFrame ? undefined : 'none',
    borderLeft: usesInsetFrame ? undefined : 'none',
    borderRight: usesInsetFrame ? undefined : 'none',
    boxShadow: 'none',
    backgroundImage: 'var(--layout-header-pattern)',
    backgroundSize: '24px 24px',
    color: 'var(--foreground)',
    zIndex: 1300,
    top: usesInsetFrame ? 'var(--shell-gap)' : 0,
    left: usesInsetFrame ? headerInsetOffset : 0,
    right: usesInsetFrame ? headerInsetOffset : 0,
    borderRadius: showLandscapeNavItems ? '0px' : 'var(--layout-header-border-radius)',
    overflow: 'visible',
    boxSizing: 'border-box',
  };

  const topRowGap = showLandscapeNavItems ? 10 : 16;

  return (
    <header
      data-layout-contract-header
      data-layout-breakpoint={layoutPolicy.breakpoint}
      data-nav-placement={layoutPolicy.navPlacement}
      data-header-frame-mode={layoutPolicy.headerFrameMode}
      data-nav-container
      style={{
        ...(layoutCssVars as React.CSSProperties),
        ...headerStyle,
      }}
    >
      <div
        data-testid="nav-header-inner"
        style={{
          display: 'flex',
          flexDirection: showLandscapeNavItems ? 'column' : 'row',
          gap: showLandscapeNavItems ? 6 : 16,
          paddingLeft: headerHorizontalPadding,
          paddingRight: headerHorizontalPadding,
          paddingTop: showLandscapeNavItems ? 8 : 0,
          paddingBottom: showLandscapeNavItems ? 6 : 0,
          minHeight: showLandscapeNavItems ? 96 : 64,
          alignItems: showLandscapeNavItems ? 'stretch' : 'center',
          position: 'relative',
        }}
      >
        <Box
          className="flex items-center min-w-0"
          style={{
            width: '100%',
            gap: topRowGap,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {((!isMobile && !isTopNav) || (isMobile && layoutPolicy.showHeaderToggleOnMobile)) && (
            <IconButton
              className="pop-toggle"
              aria-label="toggle navigation"
              onClick={toggleDrawer}
              style={{
                width: 'var(--layout-header-toggle-width)',
                height: 'var(--layout-header-toggle-height)',
                borderRadius: 'var(--layout-header-toggle-radius)',
                color: 'var(--layout-header-toggle-color)',
                marginRight: isTopNav ? 8 : 0,
              }}
            >
              {layoutPolicy.headerToggleMode === 'collapse' ? (
                isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />
              ) : (
                <MenuIcon />
              )}
            </IconButton>
          )}

          <Box
            className="flex items-center min-w-0"
            style={{
              height: APP_BAR_TOGGLE_SIZE,
              flex: '1 1 auto',
              minWidth: 0,
              marginRight: showTopNavItems && !showLandscapeNavItems ? 32 : 0,
            }}
          >
            <RouterLink
              to="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: showHeaderLogo && showHeaderWordmark ? 5 : 0,
                marginLeft: 'var(--layout-header-title-inset)',
                textDecoration: 'none',
                minWidth: 0,
              }}
            >
              {showHeaderLogo && (
                <img
                  src="/logo192.png"
                  alt="Youtarr logo"
                  style={{
                    width: showLandscapeNavItems ? 28 : 32,
                    height: showLandscapeNavItems ? 28 : 32,
                    flexShrink: 0,
                    objectFit: 'contain',
                  }}
                />
              )}
              {showHeaderWordmark ? (
                <img
                  src={youtarrWordmark}
                  alt={appName}
                  style={{
                    height: showLandscapeNavItems ? 35 : 40,
                    maxWidth: 'min(234px, 58.5vw)',
                    width: 'auto',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              ) : (
                <Typography
                  variant="h6"
                  style={{
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    whiteSpace: 'nowrap',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    lineHeight: `${APP_BAR_TOGGLE_SIZE}px`,
                    fontSize: showLandscapeNavItems ? '1.1rem' : '1.35rem',
                    color: 'var(--foreground)',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  } as React.CSSProperties}
                >
                  {appName}
                </Typography>
              )}
            </RouterLink>
          </Box>

          {!showTopNavItems && <Box className="flex-1" />}

          <NavHeaderActions
            layoutPolicy={layoutPolicy}
            token={token}
            isPlatformManaged={isPlatformManaged}
            versionLabel={versionLabel}
            updateAvailable={updateAvailable}
            updateTooltip={updateTooltip}
            ytDlpUpdateAvailable={ytDlpUpdateAvailable}
            ytDlpUpdateTooltip={ytDlpUpdateTooltip}
            onLogout={onLogout}
            isMobile={isMobile}
            showLandscapeNavItems={showLandscapeNavItems}
            showTopNavItems={showTopNavItems}
          />
        </Box>

        {showTopNavItems && (
          <NavHeaderTopItems
            navItems={navItems}
            showLandscapeNavItems={showLandscapeNavItems}
            menuPaperStyle={menuPaperStyle}
          />
        )}
      </div>
    </header>
  );
};
