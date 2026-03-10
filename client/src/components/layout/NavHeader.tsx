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
import { LogOut as LogoutIcon, Download as DownloadIcon, Menu as MenuIcon, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from '../../lib/icons';
import { getThemeLayoutCssVars, ThemeLayoutPolicy } from '../../themes';
import { StorageHeaderWidget } from './StorageHeaderWidget';
import { NAV_DRAWER_SECTION_BUTTON_GUTTER } from './navLayoutConstants';
import './layoutFallback.css';

interface NavHeaderProps {
  appName: string;
  layoutPolicy: ThemeLayoutPolicy;
  navItems: any[];
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

  const isMobile = layoutPolicy.breakpoint === 'mobile';
  const isTopNav = layoutPolicy.navPlacement === 'top';
  const isInsetFrame = layoutPolicy.headerFrameMode === 'inset';
  const isPlayful = layoutPolicy.headerUpdateIndicatorMode === 'playful';
  const isLinear = layoutPolicy.headerUpdateIndicatorMode === 'linear';
  const isFlat = layoutPolicy.headerUpdateIndicatorMode === 'flat';

  // --- State ---
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // --- Policy Computed Values ---
  const showTopNavItems = layoutPolicy.showDesktopNavItems && !isMobile;
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
    if (layoutPolicy.headerUpdateIndicatorMode === 'playful') {
      return {
        width: 40,
        height: 40,
        borderRadius: 'var(--radius-ui)',
        color: 'var(--warning-foreground)',
        backgroundColor: 'var(--warning)',
        border: '2px solid var(--border-strong)',
        boxShadow: 'var(--shadow-hard)',
      };
    }

    if (layoutPolicy.headerUpdateIndicatorMode === 'flat') {
      return {
        width: 34,
        height: 34,
        borderRadius: 'var(--radius-ui)',
        color: 'var(--warning-foreground)',
        backgroundColor: 'var(--warning)',
        border: '2px solid var(--foreground)',
      };
    }

    return {
      width: 32,
      height: 32,
      borderRadius: '6px',
      color: 'var(--warning)',
      backgroundColor: 'transparent',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    };
  }, [layoutPolicy.headerUpdateIndicatorMode]);

  const versionParts = useMemo(() => {
    if (!versionLabel) return [] as string[];
    return versionLabel.split('•').map((part) => part.trim()).filter(Boolean);
  }, [versionLabel]);

  // --- Effects ---
  
  // Close dropdown on route change
  useEffect(() => {
    setActiveKey(null);
  }, [location.pathname]);

  // --- Event Handlers (Single Unit Hover) ---

  const handleUnitEnter = (event: React.MouseEvent<HTMLElement>, key: string) => {
    setActiveKey(key);
  };

  const handleUnitLeave = () => {
    setActiveKey(null);
  };

  // --- Styles Helper ---

  const getButtonStyle = (isParentActive: boolean): React.CSSProperties => {
    const activeColor = (isLinear || isFlat) ? 'hsl(var(--primary))' : 'var(--foreground)';
    const defaultColor = 'var(--muted-foreground)';
    return {
      color: isParentActive ? activeColor : defaultColor,
      fontWeight: 600,
      fontSize: '0.85rem',
      textTransform: 'none' as const,
      padding: '8px 12px',
      borderRadius: 'var(--radius-ui)',
      transition: 'all 0.15s ease-out',
      position: 'relative' as const,
    };
  };

  const menuPaperStyle: React.CSSProperties = {
    overflow: 'visible',
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
    borderTop: isInsetFrame ? undefined : 'none',
    borderLeft: isInsetFrame ? undefined : 'none',
    borderRight: isInsetFrame ? undefined : 'none',
    boxShadow: 'none',
    backgroundImage: 'var(--layout-header-pattern)',
    backgroundSize: '24px 24px',
    color: 'var(--foreground)',
    zIndex: 1300,
    top: isInsetFrame ? 'var(--shell-gap)' : 0,
    left: isInsetFrame ? 'var(--shell-gap)' : 0,
    right: isInsetFrame ? 'var(--shell-gap)' : 0,
    width: isInsetFrame ? 'calc(100vw - (var(--shell-gap) * 2))' : '100vw',
    borderRadius: 'var(--layout-header-border-radius)',
    overflow: 'visible',
  };

  // Match the drawer button inset so the toggle sits flush with the sidebar edges.
  const headerHorizontalGutter = NAV_DRAWER_SECTION_BUTTON_GUTTER;

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
        style={{
          display: 'flex',
          gap: 16,
          paddingLeft: headerHorizontalGutter,
          paddingRight: headerHorizontalGutter,
          minHeight: 64,
          alignItems: 'center',
          position: 'relative',
        }}
      >
        {/* Toggle (Mobile/Side) */}
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

        {/* Title */}
        <Box
          className="flex items-center min-w-0"
          style={{
            height: APP_BAR_TOGGLE_SIZE,
            marginRight: showTopNavItems ? 32 : 0,
          }}
        >
          <RouterLink
            to="/"
            style={{
              display: 'inline-flex',
              marginLeft: 'var(--layout-header-title-inset)',
              textDecoration: 'none',
            }}
          >
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
              fontSize: '1.35rem',
              color: 'var(--foreground)',
              textDecoration: 'none',
              cursor: 'pointer',
            } as React.CSSProperties}
          >
            {appName}
          </Typography>
          </RouterLink>
        </Box>

        {/* Desktop Navigation */}
        {showTopNavItems && (
          <Box
            className="flex items-center gap-2"
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              height: '100%',
            }}
          >
            {navItems.map((item) => {
              const isOpen = activeKey === item.key;
              const hasSubItems = item.subItems && item.subItems.length > 0;

              const isParentActive = location.pathname === item.to
                || location.pathname.startsWith(item.to + '/')
                || item.subItems?.some((subItem: any) => (
                  location.pathname === subItem.to || location.pathname.startsWith(subItem.to + '/')
                ));

              return (
                <Box
                  key={item.key}
                  onMouseEnter={(e) => hasSubItems && handleUnitEnter(e, item.key)}
                  onMouseLeave={handleUnitLeave}
                  style={{ position: 'relative', height: 'auto', display: 'flex', alignItems: 'center' }}
                >
                  <Button
                    asChild
                    variant="text"
                    startIcon={item.icon}
                    style={getButtonStyle(isParentActive)}
                  >
                    <RouterLink to={item.to}>{item.label}</RouterLink>
                  </Button>

                  {hasSubItems && isOpen && (
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
                        {item.subItems.map((subItem: any) => {
                          const isSubActive = location.pathname === subItem.to || location.pathname.startsWith(subItem.to + '/');
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
                                  ? ((isLinear || isFlat) ? 'hsl(var(--primary))' : 'var(--foreground)')
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
        )}

        {/* Spacer */}
        {!showTopNavItems && <Box className="flex-1" />}

        {/* Right Actions */}
        <Box
          className="flex items-center"
          style={{ marginLeft: showTopNavItems ? 'auto' : 0 }}
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

          {layoutPolicy.headerVersionPlacement === 'mobile' && isMobile && versionParts.length > 0 && (
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
              <IconButton
                aria-label={sharedUpdateAriaLabel}
                className="mr-1"
                style={sharedUpdateIndicatorStyle}
              >
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
      </div>
    </header>
  );
};
