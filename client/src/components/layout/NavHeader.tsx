import React, { useState, useRef, useEffect } from 'react';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Fade,
  useTheme,
} from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import LogoutIcon from '@mui/icons-material/Logout';
import DownloadIcon from '@mui/icons-material/Download';
import MenuIcon from '@mui/icons-material/Menu';
import { ThemeMode } from '../../contexts/ThemeEngineContext';

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
  onLogout?: () => void;
  toggleDrawer: () => void;
  APP_BAR_TOGGLE_SIZE: number;
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
  onLogout,
  toggleDrawer,
  APP_BAR_TOGGLE_SIZE,
}) => {
  const location = useLocation();
  const theme = useTheme();

  const [activeDropdown, setActiveDropdown] = useState<{ key: string; anchor: HTMLElement | null } | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const lastPointerTypeRef = useRef<'mouse' | 'touch' | 'pen'>('mouse');

  const isLinear = themeMode === 'linear';
  const isFlat = themeMode === 'flat';
  const isNeumorphic = themeMode === 'neumorphic';
  const isTopNav = isLinear || isFlat || isNeumorphic;
  const showTopNavItems = isTopNav && !isMobile;
  const navTextPrimary = theme.palette.text.primary;
  const navTextSecondary = theme.palette.text.secondary;
  const versionParts = React.useMemo(() => {
    if (!versionLabel) return [] as string[];
    return versionLabel.split('•').map((part) => part.trim()).filter(Boolean);
  }, [versionLabel]);

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const openDropdown = (event: React.MouseEvent<HTMLElement>, key: string) => {
    clearHoverTimeout();
    setActiveDropdown({ key, anchor: event.currentTarget });
  };

  const scheduleClose = () => {
    clearHoverTimeout();
    // Delay to allow mouse to move from button to menu without flicker
    hoverTimeoutRef.current = window.setTimeout(() => {
      setActiveDropdown(null);
      hoverTimeoutRef.current = null;
    }, 150);
  };

  const keepDropdownOpen = () => {
    clearHoverTimeout();
  };

  const isDropdownOpen = (key: string) => activeDropdown?.key === key;

  const closeDropdown = () => {
    clearHoverTimeout();
    setActiveDropdown(null);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!activeDropdown) return;
      
      // Check if click is outside any nav elements
      const navBar = (event.currentTarget as Document).querySelector('[data-nav-container]');
      if (navBar && !navBar.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    if (activeDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeDropdown]);

  return (
    <AppBar
      data-nav-container
      position="fixed"
      elevation={0}
      sx={{
        backgroundColor: isLinear ? 'rgba(5, 5, 6, 0.8)' : isFlat ? '#FFFFFF' : 'background.paper',
        backdropFilter: isLinear ? 'blur(12px)' : 'none',
        border: isLinear ? 'none' : isFlat ? '2px solid #E5E7EB' : isNeumorphic ? 'none' : 'var(--appbar-border)',
        borderBottom: isLinear ? '1px solid rgba(255, 255, 255, 0.1)' : isFlat ? '2px solid #E5E7EB' : 'var(--appbar-border)',
        boxShadow: 'none',
        backgroundImage: isLinear || isFlat || isNeumorphic ? 'none' : 'var(--appbar-pattern)',
        backgroundSize: '24px 24px',
        color: 'text.primary',
        zIndex: (theme) => theme.zIndex.drawer + 1,
        top: isMobile || isTopNav ? 0 : 'var(--shell-gap)',
        left: isMobile || isTopNav ? 0 : 'var(--shell-gap)',
        right: isMobile || isTopNav ? 0 : 'var(--shell-gap)',
        width: isMobile || isTopNav ? '100vw' : 'calc(100vw - (var(--shell-gap) * 2))',
        borderRadius: isTopNav ? 0 : 'var(--radius-ui)',
        overflow: 'visible',
      }}
    >
      <Toolbar sx={{ gap: 2, px: { xs: 1.5, sm: 2 }, minHeight: 64, alignItems: 'center', position: 'relative' }}>
        {isTopNav && isMobile ? (
          <IconButton
            aria-label="open drawer"
            onClick={toggleDrawer}
            sx={{ color: isLinear ? '#FFFFFF' : isFlat ? '#111827' : 'inherit', mr: 1 }}
          >
            <MenuIcon />
          </IconButton>
        ) : !isTopNav ? (
          <IconButton
            className="pop-toggle"
            aria-label="toggle navigation"
            onClick={toggleDrawer}
            sx={{
              width: APP_BAR_TOGGLE_SIZE,
              height: APP_BAR_TOGGLE_SIZE,
              p: 0,
              borderRadius: '50%',
              color: 'var(--foreground)',
            }}
          >
            {/* The icon itself will be rotated via CSS/transition in AppShell if needed, 
                or we can just use a MenuIcon here too for simplicity when refactoring */}
            <MenuIcon />
          </IconButton>
        ) : null}

        <Box sx={{ display: 'flex', alignItems: 'center', height: APP_BAR_TOGGLE_SIZE, minWidth: 0, mr: showTopNavItems ? 4 : 0 }}>
          <Typography
            variant="h6"
            component={RouterLink}
            to="/channels"
            sx={{
              fontWeight: 700,
              fontFamily: 'Outfit',
              whiteSpace: 'nowrap',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              lineHeight: `${APP_BAR_TOGGLE_SIZE}px`,
              fontSize: '1.35rem',
              color: navTextPrimary,
              letterSpacing: 'normal',
              textDecoration: 'none',
              cursor: 'pointer',
              '&:hover': {
                opacity: 0.8,
              },
            }}
          >
            {appName}
          </Typography>
        </Box>

        {showTopNavItems && (
          <Box
            sx={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}
            onMouseLeave={scheduleClose}
            onMouseEnter={keepDropdownOpen}
          >
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {navItems.map((item) => {
                const isParentActive = location.pathname === item.to
                  || location.pathname.startsWith(item.to + '/')
                  || item.subItems?.some((subItem: any) => (
                    location.pathname === subItem.to || location.pathname.startsWith(subItem.to + '/')
                  ));

                return (
                <Box
                  key={item.key}
                  sx={{ position: 'relative' }}
                >
                  <Button
                    onPointerDown={(event) => {
                      lastPointerTypeRef.current = event.pointerType as 'mouse' | 'touch' | 'pen';
                    }}
                    onMouseEnter={(e) => {
                      if (item.subItems && lastPointerTypeRef.current === 'mouse') {
                        openDropdown(e, item.key);
                      }
                    }}
                    onClick={(event) => {
                      if (!item.subItems) return;
                      if (lastPointerTypeRef.current !== 'mouse') {
                        if (!isDropdownOpen(item.key)) {
                          event.preventDefault();
                          openDropdown(event as unknown as React.MouseEvent<HTMLElement>, item.key);
                        }
                      }
                    }}
                    component={RouterLink}
                    to={item.to}
                    variant="text"
                    startIcon={item.icon}
                    sx={{
                      color: isParentActive ? ((isLinear || isFlat) ? theme.palette.primary.main : navTextPrimary) : navTextSecondary,
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      textTransform: 'none',
                      px: 1.5,
                      py: 1,
                      borderRadius: 'var(--radius-ui)',
                      position: 'relative',
                      '&::after': (isLinear || isFlat) && isParentActive ? {
                        content: '""',
                        position: 'absolute',
                        bottom: 4,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '20px',
                        height: '3px',
                        bgcolor: theme.palette.primary.main,
                        borderRadius: '2px',
                      } : {},
                      '&:hover': {
                        color: (isLinear || isFlat) ? theme.palette.primary.main : navTextPrimary,
                        bgcolor: isLinear ? 'rgba(255, 255, 255, 0.05)' : isFlat ? 'rgba(59, 130, 246, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                        transform: 'none',
                      },
                      '& .MuiButton-startIcon': {
                        mr: 0.8,
                        '& svg': { fontSize: '1.2rem' }
                      }
                    }}
                  >
                    {item.label}
                  </Button>

                  {item.subItems && (
                    <Menu
                      anchorEl={isDropdownOpen(item.key) ? activeDropdown?.anchor : null}
                      open={isDropdownOpen(item.key)}
                      onClose={closeDropdown}
                      disableScrollLock
                      hideBackdrop
                      disableAutoFocus
                      keepMounted
                      slotProps={{
                        paper: {
                          sx: {
                            pointerEvents: 'auto',
                            zIndex: theme.zIndex.modal + 1,
                          },
                          onMouseEnter: keepDropdownOpen,
                          onMouseLeave: scheduleClose,
                        },
                      }}
                      MenuListProps={{
                        sx: {
                          py: (isLinear || isFlat) ? 0.5 : 0.75,
                          px: (isLinear || isFlat) ? 0.5 : 0.75,
                          minWidth: 180,
                          width: 'max-content',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: (isLinear || isFlat) ? 0.2 : 0.4,
                        },
                      }}
                      TransitionComponent={Fade}
                      TransitionProps={{ timeout: { enter: 150, exit: 150 } }}
                      PopperProps={{
                        modifiers: [
                          {
                            name: 'preventOverflow',
                            options: {
                              padding: 8,
                            },
                          },
                          {
                            name: 'offset',
                            options: {
                              offset: [0, 8],
                            },
                          },
                        ],
                      }}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                      elevation={0}
                      PaperProps={{
                        sx: {
                          overflow: 'visible',
                          width: 'max-content',
                          minWidth: 180,
                          borderRadius: isLinear ? '12px' : isFlat ? '8px' : isNeumorphic ? '16px' : 'var(--radius-ui)',
                          border: isLinear
                            ? '1px solid rgba(255, 255, 255, 0.1)'
                            : isFlat
                              ? '2px solid #E5E7EB'
                              : isNeumorphic
                                ? 'none'
                                : '2px solid var(--border-strong)',
                          bgcolor: isLinear
                            ? '#09090b'
                            : isFlat
                              ? '#FFFFFF'
                              : isNeumorphic
                                ? '#E0E5EC'
                                : '#FFFFFF',
                          boxShadow: isLinear ? '0 10px 40px rgba(0,0,0,0.5)' : 'none',
                          mt: 0,
                          px: (isLinear || isFlat) ? 1 : 1,
                          py: (isLinear || isFlat) ? 0.75 : 0.75,
                        },
                      }}
                    >
                      {item.subItems.map((subItem: any) => (
                        <MenuItem
                          key={subItem.key}
                          component={RouterLink}
                          to={subItem.to}
                          onClick={closeDropdown}
                          sx={{
                            borderRadius: (isLinear || isFlat) ? '6px' : 'var(--radius-ui)',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            color: location.pathname === subItem.to ? ((isLinear || isFlat) ? theme.palette.primary.main : navTextPrimary) : navTextSecondary,
                            '&:hover': {
                              color: (isLinear || isFlat) ? theme.palette.primary.main : navTextPrimary,
                              bgcolor: isLinear
                                ? 'rgba(255, 255, 255, 0.08)'
                                : isFlat
                                  ? '#F3F4F6'
                                  : isNeumorphic
                                    ? 'rgba(108, 99, 255, 0.12)'
                                    : '#F3F4F6',
                              boxShadow: 'none',
                            },
                            py: 0.75,
                            minWidth: 160,
                          }}
                        >
                          {subItem.label}
                        </MenuItem>
                      ))}
                    </Menu>
                  )}
                </Box>
              );
              })}
            </Box>
          </Box>
        )}

        {!showTopNavItems && <Box sx={{ flexGrow: 1 }} />}
        <Box sx={{ display: 'flex', alignItems: 'center', ml: showTopNavItems ? 'auto' : 0 }}>
          {(isLinear || isFlat) && versionParts.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', mr: 1.5, lineHeight: 1.1 }}>
              <Typography variant="caption" sx={{ color: navTextSecondary, fontWeight: 600, fontSize: '0.6rem' }}>
                {versionParts[0]}
              </Typography>
              {versionParts[1] && (
                <Typography variant="caption" sx={{ color: navTextSecondary, fontSize: '0.6rem' }}>
                  {versionParts[1]}
                </Typography>
              )}
            </Box>
          )}
          {token && !isPlatformManaged && updateAvailable && updateTooltip && (
            <Tooltip title={updateTooltip} placement="bottom" arrow>
              <IconButton
                aria-label="new version available"
                sx={{
                  color: 'common.white',
                  bgcolor: 'warning.main',
                  borderRadius: '50%',
                  '&:hover': {
                    bgcolor: 'warning.dark',
                  },
                  mr: 0.5,
                }}
              >
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          )}

          {token && !isPlatformManaged && onLogout && (
            <IconButton aria-label="logout" onClick={onLogout} sx={{ color: navTextPrimary }}>
              <LogoutIcon />
            </IconButton>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};
