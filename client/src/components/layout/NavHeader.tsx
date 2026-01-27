import React, { useState, useRef } from 'react';
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
  Portal,
} from '@mui/material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const theme = useTheme();

  const [activeDropdown, setActiveDropdown] = useState<{ key: string; anchor: HTMLElement | null } | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const portalRootRef = useRef<HTMLDivElement | null>(null);

  const isLinear = themeMode === 'linear';
  const isNeumorphic = themeMode === 'neumorphic';
  const isTopNav = isLinear || isNeumorphic;
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
    // Give user a bit more leeway to move from nav to menu
    hoverTimeoutRef.current = window.setTimeout(() => {
      setActiveDropdown(null);
      hoverTimeoutRef.current = null;
    }, 250);
  };

  const keepDropdownOpen = () => {
    clearHoverTimeout();
  };

  const isDropdownOpen = (key: string) => activeDropdown?.key === key;

  const closeDropdown = () => {
    clearHoverTimeout();
    setActiveDropdown(null);
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        backgroundColor: isLinear ? 'rgba(5, 5, 6, 0.8)' : 'background.paper',
        backdropFilter: isLinear ? 'blur(12px)' : 'none',
        border: isLinear || isNeumorphic ? 'none' : 'var(--appbar-border)',
        borderBottom: isLinear ? '1px solid rgba(255, 255, 255, 0.1)' : 'var(--appbar-border)',
        boxShadow: isLinear || isNeumorphic ? 'none' : 'var(--appbar-shadow)',
        backgroundImage: isLinear || isNeumorphic ? 'none' : 'var(--appbar-pattern)',
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
            sx={{ color: isLinear ? '#fff' : 'inherit', mr: 1 }}
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
                    onMouseEnter={(e) => item.subItems && openDropdown(e, item.key)}
                    component={RouterLink}
                    to={item.to}
                    variant="text"
                    startIcon={item.icon}
                    sx={{
                      color: isParentActive ? (isLinear ? theme.palette.primary.main : navTextPrimary) : navTextSecondary,
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      textTransform: 'none',
                      px: 1.5,
                      py: 1,
                      borderRadius: 'var(--radius-ui)',
                      position: 'relative',
                      '&::after': isLinear && isParentActive ? {
                        content: '""',
                        position: 'absolute',
                        bottom: 0,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '20px',
                        height: '2px',
                        bgcolor: theme.palette.primary.main,
                        borderRadius: '2px',
                      } : {},
                      '&:hover': {
                        color: isLinear ? theme.palette.primary.main : navTextPrimary,
                        bgcolor: isLinear ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
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
                      slotProps={{
                        paper: { 
                          sx: { 
                            pointerEvents: 'auto',
                            zIndex: (theme) => theme.zIndex.modal + 100,
                          },
                          onMouseEnter: keepDropdownOpen,
                          onMouseLeave: scheduleClose,
                        },
                      }}
                      MenuListProps={{
                        sx: {
                          py: isLinear ? 0.75 : 1,
                          px: isLinear ? 0.75 : 1,
                          minWidth: 200,
                          width: 'max-content',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: isLinear ? 0.25 : 0.5,
                        },
                      }}
                      TransitionComponent={Fade}
                      TransitionProps={{ timeout: { enter: 150, exit: 150 } }}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                      elevation={isLinear ? 0 : 8}
                      PaperProps={{
                        sx: {
                          position: 'relative',
                          overflow: 'visible',
                          width: 'max-content',
                          minWidth: 200,
                          borderRadius: 'var(--radius-ui)',
                          border: isLinear 
                            ? 'var(--border-weight) solid #333'
                            : isNeumorphic
                              ? 'none'
                              : '1px solid rgba(255,255,255,0.1)',
                          bgcolor: isLinear
                            ? '#09090b'
                            : isNeumorphic
                              ? '#E0E5EC'
                              : '#FFFFFF',
                          boxShadow: isLinear
                            ? '0 4px 20px rgba(0,0,0,0.5)'
                            : isNeumorphic
                              ? '12px 12px 20px rgba(163, 177, 198, 0.6), -12px -12px 20px rgba(255, 255, 255, 0.6)'
                              : 'none',
                          mt: 0,
                          transform: 'none',
                          px: isLinear ? 0.5 : 1,
                          py: isLinear ? 0.5 : 0.75,
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: -15,
                            left: 0,
                            right: 0,
                            height: 15,
                            background: 'transparent',
                          },
                        },
                      }}
                    >
                      {item.subItems.map((subItem: any) => (
                        <MenuItem
                          key={subItem.key}
                          onClick={() => {
                            closeDropdown();
                            // Use navigate instead of RouterLink for reliability in Portal context
                            navigate(subItem.to);
                          }}
                          sx={{
                            borderRadius: 'var(--radius-ui)',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            color: location.pathname === subItem.to ? (isLinear ? theme.palette.primary.main : navTextPrimary) : navTextSecondary,
                            '&:hover': {
                              color: isLinear ? theme.palette.primary.main : navTextPrimary,
                              bgcolor: isLinear
                                ? 'rgba(255, 255, 255, 0.08)'
                                : isNeumorphic
                                  ? 'rgba(108, 99, 255, 0.12)'
                                  : '#F3F4F6',
                              boxShadow: isNeumorphic
                                ? 'inset 3px 3px 6px rgba(163, 177, 198, 0.6), inset -3px -3px 6px rgba(255, 255, 255, 0.5)'
                                : 'none',
                            },
                            py: 0.85,
                            minWidth: 160,
                            cursor: 'pointer',
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
          {isLinear && versionParts.length > 0 && (
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
