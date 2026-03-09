import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Paper,
} from '../ui';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { LogOut as LogoutIcon, Download as DownloadIcon, Menu as MenuIcon, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from '../../lib/icons';
import { ThemeMode } from '../../themes';
import { StorageHeaderWidget } from './StorageHeaderWidget';
import { NAV_DRAWER_SECTION_BUTTON_GUTTER } from './navLayoutConstants';

interface NavHeaderProps {
  appName: string;
  isMobile: boolean;
  themeMode: ThemeMode;
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
  isMobile,
  themeMode,
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

  const isPlayful = themeMode === 'playful';

  // --- State ---
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // --- Theme Computed Values ---
  const isLinear = themeMode === 'linear';
  const isFlat = themeMode === 'flat';
  const isTopNav = isLinear || isFlat;
  const showTopNavItems = isTopNav && !isMobile;
  const topNavTitleInset = isTopNav && !isMobile ? 12 : 0;
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
    if (isPlayful) {
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

    if (isFlat) {
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
  }, [isFlat, isPlayful]);

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
    borderRadius: isLinear ? '12px' : isFlat ? '8px' : 'var(--radius-ui)',
    border: isLinear
      ? '1px solid rgba(255, 255, 255, 0.1)'
      : isFlat
        ? '2px solid var(--border)'
        : '2px solid var(--border-strong)',
    backgroundColor: isLinear
      ? '#09090b'
      : isFlat
        ? 'var(--card)'
        : 'var(--card)',
    boxShadow: isLinear ? '0 10px 40px rgba(0,0,0,0.5)' : isFlat ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
    padding: '4px',
  };

  const headerStyle: React.CSSProperties = {
    position: 'fixed',
    backgroundColor: isLinear ? 'rgba(5, 5, 6, 0.72)' : 'var(--card)',
    backdropFilter: isLinear ? 'none' : 'none',
    border: isLinear ? 'none' : isFlat ? '2px solid var(--border)' : 'var(--appbar-border)',
    borderBottom: isLinear ? '1px solid rgba(255, 255, 255, 0.1)' : isFlat ? '2px solid var(--border)' : 'var(--appbar-border)',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    boxShadow: 'none',
    backgroundImage: isLinear || isFlat ? 'none' : 'var(--appbar-pattern)',
    backgroundSize: '24px 24px',
    color: 'var(--foreground)',
    zIndex: 1300,
    top: isMobile || isTopNav ? 0 : 'var(--shell-gap)',
    left: isMobile || isTopNav ? 0 : 'var(--shell-gap)',
    right: isMobile || isTopNav ? 0 : 'var(--shell-gap)',
    width: isMobile || isTopNav ? '100vw' : 'calc(100vw - (var(--shell-gap) * 2))',
    borderRadius: isTopNav ? 0 : 'var(--radius-ui)',
    overflow: 'visible',
  };

  // Match the drawer button inset so the toggle sits flush with the sidebar edges.
  const headerHorizontalGutter = NAV_DRAWER_SECTION_BUTTON_GUTTER;

  return (
    <header
      data-nav-container
      style={headerStyle}
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
        {(!isTopNav || isMobile) && (
          <IconButton
            className="pop-toggle"
            aria-label="toggle navigation"
            onClick={toggleDrawer}
            style={{
              width: isTopNav ? undefined : (isPlayful && !isMobile ? 57 : APP_BAR_TOGGLE_SIZE),
              height: isTopNav ? undefined : (isPlayful && !isMobile ? 40 : APP_BAR_TOGGLE_SIZE),
              borderRadius: (isTopNav || isPlayful) ? 'var(--radius-ui)' : '50%',
              color: isLinear ? '#FFFFFF' : isFlat ? '#111827' : 'inherit',
              marginRight: isTopNav ? 8 : 0,
            }}
          >
            {isPlayful ? (
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
              marginLeft: topNavTitleInset,
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
                                borderRadius: (isLinear || isFlat) ? '6px' : 'var(--radius-ui)',
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
          {(isLinear || isFlat) && !isMobile && versionParts.length > 0 && (
            <Box className="flex flex-col items-end mr-3" style={{ lineHeight: 1.1 }}>
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

          {token && !isPlayful && !(isMobile && (isLinear || isFlat)) && <StorageHeaderWidget token={token} />}

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
