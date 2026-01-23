import React, { useEffect, useMemo, useState } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import SubscriptionsIcon from '@mui/icons-material/Subscriptions';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import DownloadIcon from '@mui/icons-material/Download';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { StorageFooterWidget } from './StorageFooterWidget';
import { SETTINGS_PAGES } from '../Settings/SettingsIndex';

export type AppNavKey = 'channels' | 'videos' | 'downloads' | 'settings';

interface AppShellProps {
  token: string | null;
  isPlatformManaged: boolean;
  appName?: string;
  logoSrc?: string;
  versionLabel?: string;
  onLogout?: () => void;
  children: React.ReactNode;
}

const EXPANDED_WIDTH = 200;
const COLLAPSED_WIDTH = 65;

const NAV_MAIN_MIN_HEIGHT = 40; // target height for each main nav button (px)
const NAV_SUB_MIN_HEIGHT = 20; // sub-item buttons stay slightly smaller
const NAV_EXPANDED_HORIZONTAL_PADDING = 1.6;
const NAV_COLLAPSED_HORIZONTAL_PADDING = 1.6;
const NAV_ICON_SIZE = 25; // same icon size collapsed vs expanded
const NAV_ICON_MARGIN = 0.35; // keeps text offset consistent
const NAV_PRIMARY_FONT_SIZE = '0.85rem';
const NAV_PRIMARY_LINE_HEIGHT = 1.15;
const NAV_SECONDARY_FONT_SIZE = '0.65rem';
const NAV_SECONDARY_LINE_HEIGHT = 1.1;
const NAV_MAIN_GAP = .75;
const NAV_SUB_VERTICAL_GAP = 0.75;
const NAV_SUB_PADDING_LEFT = 3.5;
const NAV_SUB_PADDING_RIGHT = 2;
const NAV_SUB_TEXT_INDENT = 3.5;
const NAV_SUB_HIGHLIGHT_LEFT_PADDING = 1.25; // spacing between left border (highlight) and sub-item text
const NAV_SUB_FONT_SIZE = '0.8rem';
const NAV_SUB_LINE_HEIGHT = 1.2;
const NAV_DRAWER_BORDER_RADIUS = 'var(--nav-radius)';
const NAV_DRAWER_DESKTOP_TOP_OFFSET = 'calc(80px + var(--shell-gap))';
const NAV_DRAWER_DESKTOP_BOTTOM_GAP = 'calc(20px + var(--shell-gap))';
const NAV_DRAWER_DESKTOP_MAX_HEIGHT = 'calc(100vh - (64px + (var(--shell-gap) * 2)))';
const NAV_DRAWER_MOBILE_TOP_OFFSET = 'calc(60px + var(--shell-gap))';
const NAV_DRAWER_MOBILE_BOTTOM_GAP = 'calc(20px + var(--shell-gap))';
const NAV_DRAWER_MOBILE_MAX_HEIGHT = 'calc(100vh - 64px - var(--shell-gap))';

export function AppShell({
  token,
  isPlatformManaged,
  appName = 'Youtarr',
  logoSrc,
  versionLabel,
  onLogout,
  children,
}: AppShellProps) {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [drawerOpenMobile, setDrawerOpenMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const drawerWidth = isMobile ? EXPANDED_WIDTH : collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
  const isNavCollapsed = !isMobile && collapsed;
  // icon box size stays constant so the icon doesn't shift during collapse
  const iconBoxSize = NAV_ICON_SIZE;
  const toggleRotateDeg = (isMobile ? drawerOpenMobile : !collapsed) ? 0 : 180;

  useEffect(() => {
    const navWidth = isMobile ? 0 : collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
    document.documentElement.style.setProperty('--nav-width', `${navWidth}px`);
  }, [collapsed, isMobile]);

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
    if (isMobile) {
      setDrawerOpenMobile((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
        <List sx={{ px: 0, pt: 0.5, gap: NAV_MAIN_GAP, display: 'flex', flexDirection: 'column' }}>
          {navItems.map((item) => {
          const selected = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
          const button = (
            <Box key={item.key} sx={{ px: 0.5, py: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
              <ListItemButton
                component={RouterLink}
                to={item.to}
                selected={selected}
                onClick={() => {
                  if (isMobile) setDrawerOpenMobile(false);
                }}
                sx={{
                  borderRadius: 2.5,
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  pl: isNavCollapsed ? NAV_COLLAPSED_HORIZONTAL_PADDING : NAV_EXPANDED_HORIZONTAL_PADDING,
                  pr: isNavCollapsed ? NAV_COLLAPSED_HORIZONTAL_PADDING : NAV_EXPANDED_HORIZONTAL_PADDING,
                  py: 0,
                  // explicit control of main nav button height
                  minHeight: NAV_MAIN_MIN_HEIGHT,
                  height: NAV_MAIN_MIN_HEIGHT,
                  // always fill available width to avoid overflowing the collapsed drawer
                  width: '100%',
                  border: selected ? 'var(--nav-item-border-selected)' : 'var(--nav-item-border)',
                  bgcolor: selected ? 'var(--nav-item-bg-selected)' : 'var(--nav-item-bg)',
                  color: 'text.primary',
                  boxShadow: selected ? 'var(--nav-item-shadow-selected)' : 'var(--nav-item-shadow)',
                  transition: 'all 300ms var(--transition-bouncy)',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: selected ? 'var(--nav-item-bg-selected)' : 'var(--nav-item-bg-hover)',
                    transform: selected ? 'var(--nav-item-transform-hover)' : 'var(--nav-item-transform)',
                    boxShadow: selected ? 'var(--nav-item-shadow-hover)' : 'var(--nav-item-shadow)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: iconBoxSize,
                    width: iconBoxSize,
                    height: iconBoxSize,
                    flex: `0 0 ${iconBoxSize}px`,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: 'text.primary',
                    flexShrink: 0,
                    mr: NAV_ICON_MARGIN,
                    '& svg': { fontSize: iconBoxSize - 4 },
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  secondary={item.oldLabel}
                  sx={{
                    opacity: isNavCollapsed ? 0 : 1,
                    maxWidth: isNavCollapsed ? 0 : '100%',
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    transition: 'opacity 200ms var(--transition-bouncy), max-width 200ms var(--transition-bouncy)',
                  }}
                  primaryTypographyProps={{
                    sx: {
                      fontWeight: 700,
                      fontSize: NAV_PRIMARY_FONT_SIZE,
                      lineHeight: NAV_PRIMARY_LINE_HEIGHT,
                    },
                    noWrap: true,
                  }}
                  secondaryTypographyProps={{
                    variant: 'caption',
                    color: 'text.secondary',
                    sx: {
                      fontSize: NAV_SECONDARY_FONT_SIZE,
                      lineHeight: NAV_SECONDARY_LINE_HEIGHT,
                    },
                    noWrap: true,
                  }}
                />
              </ListItemButton>
              {!isNavCollapsed && item.subItems && selected && (item.key === 'settings' || item.key === 'downloads') && (
                <List disablePadding sx={{ mt: NAV_SUB_VERTICAL_GAP, display: 'flex', flexDirection: 'column', gap: NAV_SUB_VERTICAL_GAP }}>
                  {item.subItems.map((subItem) => {
                    const subSelected = location.pathname === subItem.to;
                    return (
                      <ListItemButton
                        key={subItem.key}
                        component={RouterLink}
                        to={subItem.to}
                        selected={subSelected}
                        onClick={() => {
                          if (isMobile) setDrawerOpenMobile(false);
                        }}
                        sx={(theme) => ({
                          borderRadius: 2,
                          pl: 0,
                          pr: NAV_SUB_PADDING_RIGHT,
                          py: 0,
                          minHeight: NAV_SUB_MIN_HEIGHT,
                          height: NAV_SUB_MIN_HEIGHT,
                          width: `calc(100% - ${theme.spacing(NAV_SUB_TEXT_INDENT)})`,
                          ml: theme.spacing(NAV_SUB_TEXT_INDENT),
                          border: subSelected ? 'var(--nav-item-border-selected)' : '1px solid transparent',
                          bgcolor: subSelected ? 'var(--nav-item-bg-selected)' : 'transparent',
                          boxShadow: subSelected ? 'var(--nav-item-shadow-selected)' : 'none',
                          color: subSelected ? 'text.primary' : 'text.secondary',
                          '&:hover': {
                            bgcolor: 'transparent',
                            transform: 'none',
                            boxShadow: 'none',
                          },
                        })}
                      >
                        <ListItemText
                          primary={subItem.label}
                          sx={(theme) => ({
                            minWidth: 0,
                            pl: theme.spacing(NAV_SUB_HIGHLIGHT_LEFT_PADDING),
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                          })}
                          primaryTypographyProps={{
                            variant: 'body2',
                            sx: {
                              fontWeight: subSelected ? 700 : 500,
                              fontSize: NAV_SUB_FONT_SIZE,
                              lineHeight: NAV_SUB_LINE_HEIGHT,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            },
                            noWrap: true,
                          }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              )}
            </Box>
          );

          if (!isNavCollapsed) return button;

          return (
            <Tooltip key={item.key} title={`${item.label} — ${item.oldLabel}`} placement="right" arrow>
              {button}
            </Tooltip>
          );
        })}
        </List>
      </Box>

      <Divider sx={{ my: 1 }} />

      <Box sx={{ px: collapsed ? 1 : 2, pb: 0.5, textAlign: 'left' }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={versionLabel}
        >
          {versionLabel}
        </Typography>
      </Box>

      <StorageFooterWidget token={token} collapsed={collapsed} />

      <Box sx={{ height: 8 }} />
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'flex',
          gap: 'var(--shell-gap)',
        minHeight: '100vh',
        position: 'relative',
        bgcolor: 'background.default',
        background: `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 55%, ${theme.palette.background.default} 100%)`,
      }}
    >
      <CssBaseline />

      <Box
        aria-hidden
        className="playful-shape"
        sx={{
          position: 'absolute',
          top: 92,
          right: { xs: -120, md: -60 },
          width: { xs: 180, md: 220 },
          height: { xs: 180, md: 220 },
          borderRadius: '50%',
          bgcolor: 'var(--tertiary)',
          border: '3px solid var(--foreground)',
          boxShadow: 'var(--shadow-hard)',
          opacity: 0.8,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <Box
        aria-hidden
        className="playful-shape"
        sx={{
          position: 'absolute',
          bottom: { xs: 80, md: 120 },
          left: { xs: -140, md: -80 },
          width: { xs: 200, md: 260 },
          height: { xs: 120, md: 140 },
          borderRadius: '999px',
          bgcolor: 'var(--secondary)',
          border: '3px solid var(--foreground)',
          boxShadow: 'var(--shadow-hard)',
          transform: 'rotate(-8deg)',
          opacity: 0.7,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <Box
        aria-hidden
        className="playful-shape"
        sx={{
          position: 'absolute',
          top: { xs: 260, md: 220 },
          left: { xs: 24, md: 120 },
          width: { xs: 56, md: 72 },
          height: { xs: 56, md: 72 },
          borderRadius: 2,
          bgcolor: 'var(--quaternary)',
          border: '3px solid var(--foreground)',
          boxShadow: 'var(--shadow-hard)',
          transform: 'rotate(12deg)',
          opacity: 0.65,
          zIndex: 0,
          pointerEvents: 'none',
          display: { xs: 'none', md: 'block' },
        }}
      />

      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          border: 'var(--appbar-border)',
          boxShadow: 'var(--appbar-shadow)',
          color: 'text.primary',
          zIndex: theme.zIndex.drawer + 1,
          backgroundImage: 'var(--appbar-pattern)',
          backgroundSize: '24px 24px',
          // inset from the very top to provide top padding on desktop
          top: isMobile ? 0 : 'var(--shell-gap)',
          left: isMobile ? 0 : 'var(--shell-gap)',
          right: isMobile ? 0 : 'var(--shell-gap)',
          width: isMobile ? '100vw' : 'calc(100vw - (var(--shell-gap) * 2))',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <Toolbar sx={{ gap: 2, px: { xs: 1.5, sm: 2 }, minHeight: 64 }}>
          <IconButton 
            className="pop-toggle" 
            aria-label="toggle navigation" 
            onClick={toggleDrawer}
            sx={{ 
              transform: (isMobile ? drawerOpenMobile : !collapsed) ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'transform 450ms var(--transition-bouncy)',
              color: 'var(--foreground)'
            }}
          >
            <ChevronLeftIcon sx={{ fontSize: 24 }} />
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            {logoSrc ? (
              <Box
                component="img"
                src={logoSrc}
                alt={appName}
                sx={{ width: 28, height: 28, objectFit: 'contain' }}
              />
            ) : null}
            <Typography variant="h6" sx={{ fontWeight: 800, whiteSpace: 'nowrap', fontFamily: 'Outfit' }}>
              {appName}
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {token && !isPlatformManaged && onLogout && (
            <IconButton aria-label="logout" onClick={onLogout} sx={{ color: 'text.primary' }}>
              <LogoutIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? drawerOpenMobile : true}
          onClose={() => setDrawerOpenMobile(false)}
          ModalProps={{ keepMounted: true }}
          PaperProps={{
            className: 'app-nav-paper neumo-breathe',
            sx: {
              borderRadius: NAV_DRAWER_BORDER_RADIUS,
              borderBottomLeftRadius: NAV_DRAWER_BORDER_RADIUS,
              borderBottomRightRadius: NAV_DRAWER_BORDER_RADIUS,
              border: 'var(--nav-border)',
              boxShadow: 'var(--nav-shadow)',
              bgcolor: 'background.paper',
              // keep the drawer tucked beneath the AppBar regardless of width
              mt: isMobile ? NAV_DRAWER_MOBILE_TOP_OFFSET : NAV_DRAWER_DESKTOP_TOP_OFFSET,
              mb: isMobile ? NAV_DRAWER_MOBILE_BOTTOM_GAP : NAV_DRAWER_DESKTOP_BOTTOM_GAP,
              ml: isMobile ? 0 : 'var(--shell-gap)',
              maxHeight: isMobile ? NAV_DRAWER_MOBILE_MAX_HEIGHT : NAV_DRAWER_DESKTOP_MAX_HEIGHT,
              overflow: 'hidden',
              overflowX: 'hidden',
            },
          }}
        sx={{
          width: isMobile ? 0 : 'calc(var(--nav-width) + var(--shell-gap))',
          flexShrink: 0,
          transition: 'width 300ms var(--transition-bouncy)',
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            transition: 'width 300ms var(--transition-bouncy), padding 300ms var(--transition-bouncy)',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          minWidth: 0,
          pt: isMobile ? NAV_DRAWER_MOBILE_TOP_OFFSET : NAV_DRAWER_DESKTOP_TOP_OFFSET,
          pb: 'var(--shell-gap)',
          px: 'var(--shell-gap)',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            bgcolor: 'background.paper',
            border: '2px solid var(--foreground)',
            borderRadius: 3,
            boxShadow: 'var(--shadow-soft)',
            px: 2,
            py: { xs: 2.5, md: 3 },
            minHeight: { xs: 'calc(100vh - 220px)', md: 'calc(100vh - 200px)' },
            flex: 1,
            width: '100%',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
