import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Paper,
} from '../ui';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LogOut as LogoutIcon,
  Download as DownloadIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '../../lib/icons';
import { getThemeById, getThemeLayoutCssVars, ThemeLayoutPolicy } from '../../themes';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useThemeEngine } from '../../contexts/ThemeEngineContext';
import { StorageHeaderWidget } from './StorageHeaderWidget';
import { NAV_DRAWER_SECTION_BUTTON_GUTTER } from './navLayoutConstants';
import { NavItem, isChannelsSectionActive, isNavPathActive } from './navigation';
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
  const location = useLocation();
  const navigate = useNavigate();
  const layoutCssVars = getThemeLayoutCssVars(layoutPolicy);
  const { themeMode, showHeaderLogo, showHeaderWordmark } = useThemeEngine();
  const currentTheme = getThemeById(themeMode);

  const isMobile = layoutPolicy.breakpoint === 'mobile';
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isTopNav = layoutPolicy.navPlacement === 'top';
  const isInsetFrame = layoutPolicy.headerFrameMode === 'inset';
  const showLandscapeNavItems = isMobile && isLandscape;
  const usesInsetFrame = isInsetFrame && !showLandscapeNavItems;

  const [activeKey, setActiveKey] = useState<string | null>(null);

  const showTopNavItems = (layoutPolicy.showDesktopNavItems && !isMobile) || showLandscapeNavItems;
  const hasAppUpdate = token && !isPlatformManaged && updateAvailable && Boolean(updateTooltip);
  const hasYtDlpUpdate = token && ytDlpUpdateAvailable && Boolean(ytDlpUpdateTooltip);
  const hasAnyUpdate = Boolean(hasAppUpdate || hasYtDlpUpdate);

  const sharedUpdateTooltip = useMemo(() => {
    const sections: string[] = [];

    if (hasAppUpdate && updateTooltip) {
      sections.push(`Youtarr: ${updateTooltip}`);
    }

    if (hasYtDlpUpdate && ytDlpUpdateTooltip) {
      sections.push(`yt-dlp: ${ytDlpUpdateTooltip}`);
    }

    return sections.join(' ');
  }, [hasAppUpdate, hasYtDlpUpdate, updateTooltip, ytDlpUpdateTooltip]);

  const sharedUpdateAriaLabel = hasAppUpdate && hasYtDlpUpdate
    ? 'Youtarr and yt-dlp updates available'
    : hasAppUpdate
      ? 'Youtarr update available'
      : 'yt-dlp update available';

  const sharedUpdateIndicatorStyle: React.CSSProperties = useMemo(() => {
    return {
      width: 'var(--header-update-indicator-width)',
      height: 'var(--header-update-indicator-height)',
      borderRadius: 'var(--header-update-indicator-radius)',
      color: 'var(--header-update-indicator-foreground)',
      backgroundColor: 'var(--header-update-indicator-background)',
      border: 'var(--header-update-indicator-border)',
      boxShadow: 'var(--header-update-indicator-shadow)',
    };
  }, []);

  const versionParts = useMemo(() => {
    if (!versionLabel) return [] as string[];
    return versionLabel.split('•').map((part) => part.trim()).filter(Boolean);
  }, [versionLabel]);

  useEffect(() => {
    setActiveKey(null);
  }, [location.pathname]);

  const handleUnitEnter = (_event: React.MouseEvent<HTMLElement>, key: string) => {
    setActiveKey(key);
  };

  const handleUnitLeave = () => {
    setActiveKey(null);
  };

  const getButtonStyle = (isParentActive: boolean): React.CSSProperties => {
    return {
      color: isParentActive ? 'var(--header-nav-active-color)' : 'var(--header-nav-default-color)',
      fontWeight: 600,
      fontSize: '0.85rem',
      textTransform: 'none' as const,
      padding: '8px 12px',
      borderRadius: 'var(--radius-ui)',
      transition: 'all 0.15s ease-out',
      position: 'relative' as const,
    };
  };

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
    maxHeight: 'calc(100dvh - 80px)',
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

  const navRow = showTopNavItems ? (
    <Box
      className="flex items-center gap-2"
      style={{
        position: showLandscapeNavItems ? 'relative' : 'absolute',
        left: showLandscapeNavItems ? undefined : '50%',
        transform: showLandscapeNavItems ? undefined : 'translateX(-50%)',
        height: showLandscapeNavItems ? 'auto' : '100%',
        width: showLandscapeNavItems ? '100%' : undefined,
        flex: showLandscapeNavItems ? '0 0 auto' : undefined,
        flexWrap: showLandscapeNavItems ? 'wrap' : 'nowrap',
        minWidth: 0,
        overflow: 'visible',
        rowGap: showLandscapeNavItems ? 6 : 0,
        paddingBottom: showLandscapeNavItems ? 4 : 0,
      }}
    >
      {navItems.map((item) => {
        const isOpen = activeKey === item.key;
        const hasSubItems = item.subItems && item.subItems.length > 0;
        const isParentActive = Boolean(isChannelsSectionActive(location.pathname, item.to, item.key)
          || item.subItems?.some((subItem) => (
            isNavPathActive(location.pathname, subItem.to)
          )));

        return (
          <Box
            key={item.key}
            onMouseEnter={(event) => !showLandscapeNavItems && hasSubItems && handleUnitEnter(event, item.key)}
            onMouseLeave={() => {
              if (!showLandscapeNavItems) {
                handleUnitLeave();
              }
            }}
            style={{ position: 'relative', height: 'auto', display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            <Button
              asChild
              variant="text"
              startIcon={showLandscapeNavItems ? undefined : item.icon}
              style={{
                ...getButtonStyle(isParentActive),
                padding: showLandscapeNavItems ? '5px 10px' : '8px 12px',
                fontSize: showLandscapeNavItems ? '0.76rem' : '0.85rem',
                whiteSpace: 'nowrap',
              }}
            >
              <RouterLink to={item.to}>{item.label}</RouterLink>
            </Button>

            {hasSubItems && isOpen && !showLandscapeNavItems && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  zIndex: 1500,
                  paddingTop: 8,
                }}
              >
                <Paper style={menuPaperStyle}>
                  {(item.subItems ?? []).map((subItem) => {
                    const isSubActive = isNavPathActive(location.pathname, subItem.to);
                    return (
                      <RouterLink
                        key={subItem.key}
                        to={subItem.to}
                        onClick={handleUnitLeave}
                        style={{
                          display: 'block',
                          textDecoration: 'none',
                          width: '100%',
                          borderRadius: 'var(--layout-header-menu-radius)',
                          fontSize: '0.85rem',
                          fontWeight: 500,
                          color: isSubActive
                            ? 'var(--header-subnav-active-color)'
                            : 'var(--muted-foreground)',
                          padding: '8px 12px',
                          boxSizing: 'border-box',
                        }}
                      >
                        {subItem.label}
                      </RouterLink>
                    );
                  })}
                </Paper>
              </div>
            )}
          </Box>
        );
      })}
    </Box>
  ) : null;

  const rightActions = (
    <Box
      className="flex items-center"
      style={{ marginLeft: showTopNavItems && !showLandscapeNavItems ? 'auto' : 0, flexShrink: 0, minWidth: 0 }}
    >
      {layoutPolicy.headerVersionPlacement === 'desktop' && !isMobile && versionParts.length > 0 && (
        <Tooltip title="Click to view changelog" arrow placement="bottom">
          <Box
            className="flex flex-col items-end mr-3"
            style={{ lineHeight: 1.1, cursor: 'pointer' }}
            onClick={() => navigate('/changelog')}
          >
            <Typography variant="caption" style={{ color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '0.6rem' }}>
              {versionParts[0]}
            </Typography>
            {versionParts[1] && (
              <Box className="flex items-center gap-1">
                <Typography variant="caption" style={{ color: 'var(--muted-foreground)', fontSize: '0.6rem' }}>
                  {versionParts[1]}
                </Typography>
              </Box>
            )}
          </Box>
        </Tooltip>
      )}

      {layoutPolicy.headerVersionPlacement === 'mobile' && isMobile && !showLandscapeNavItems && versionParts.length > 0 && (
        <Tooltip title="Tap to view changelog" arrow placement="bottom">
          <Typography
            variant="caption"
            onClick={() => navigate('/changelog')}
            style={{
              color: 'var(--muted-foreground)',
              fontWeight: 600,
              fontSize: '0.6rem',
              cursor: 'pointer',
              marginRight: 4,
              userSelect: 'none',
              lineHeight: 1,
            }}
          >
            {versionParts[0]}
          </Typography>
        </Tooltip>
      )}

      {hasAnyUpdate && sharedUpdateTooltip && (
        <Tooltip title={sharedUpdateTooltip} placement="bottom" arrow>
          <IconButton aria-label={sharedUpdateAriaLabel} className="mr-1" style={sharedUpdateIndicatorStyle}>
            <DownloadIcon />
          </IconButton>
        </Tooltip>
      )}

      {token && layoutPolicy.showStorageHeaderWidget && <StorageHeaderWidget token={token} />}

      {token && !isPlatformManaged && onLogout && (
        <IconButton aria-label="logout" onClick={onLogout} style={{ color: 'var(--foreground)' }}>
          <LogoutIcon />
        </IconButton>
      )}
    </Box>
  );

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

          {rightActions}
        </Box>

        {navRow}
      </div>
    </header>
  );
};
