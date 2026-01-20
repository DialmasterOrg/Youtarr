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

const EXPANDED_WIDTH = 260;
const COLLAPSED_WIDTH = 72;

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
  const iconBoxSize = isNavCollapsed ? 56 : 64;

  useEffect(() => {
    const navWidth = isMobile ? 0 : collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
    document.documentElement.style.setProperty('--nav-width', `${navWidth}px`);
  }, [collapsed, isMobile]);

  const downloadsSubItems = useMemo(
    () => [
      { key: 'download-video', label: 'Download Video', to: '/downloads' },
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
          label: 'Download Video',
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
    if (isMobile) {
      setDrawerOpenMobile((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ minHeight: 'var(--shell-gap)' }} />
      <List sx={{ px: 1, pt: 3, gap: 0.5, display: 'flex', flexDirection: 'column' }}>
        {navItems.map((item) => {
          const selected = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
          const button = (
            <Box key={item.key}>
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
                  px: 1,
                  py: 0.5,
                  minHeight: 56,
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
                    '& svg': { fontSize: 24 },
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  secondary={item.oldLabel}
                  sx={{
                    opacity: isNavCollapsed ? 0 : 1,
                    maxWidth: isNavCollapsed ? 0 : 220,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    transition: 'opacity 200ms var(--transition-bouncy), max-width 200ms var(--transition-bouncy)',
                  }}
                  primaryTypographyProps={{ sx: { fontWeight: 700 } }}
                  secondaryTypographyProps={{
                    variant: 'caption',
                    color: 'text.secondary',
                  }}
                />
              </ListItemButton>
              {!isNavCollapsed && item.subItems && selected && (
                <List disablePadding sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
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
                        sx={{
                          borderRadius: 2,
                          pl: 9,
                          pr: 1.5,
                          py: 0.25,
                          minHeight: 40,
                          border: subSelected ? 'var(--nav-item-border-selected)' : '1px solid transparent',
                          bgcolor: subSelected ? 'var(--nav-item-bg-selected)' : 'transparent',
                          boxShadow: subSelected ? 'var(--nav-item-shadow-selected)' : 'none',
                          color: subSelected ? 'text.primary' : 'text.secondary',
                        }}
                      >
                        <ListItemText
                          primary={subItem.label}
                          primaryTypographyProps={{
                            variant: 'body2',
                            sx: { fontWeight: subSelected ? 700 : 500 },
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

      <Box sx={{ flexGrow: 1 }} />

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
          top: 0,
          right: 0,
          left: 0,
          width: '100vw',
          borderRadius: 0,
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
            borderRadius: isMobile ? 0 : 'var(--nav-radius)',
            border: 'var(--nav-border)',
            boxShadow: 'var(--nav-shadow)',
            bgcolor: 'background.paper',
            mt: isMobile ? 0 : '64px',
            mb: isMobile ? 0 : 'var(--shell-gap)',
            ml: isMobile ? 0 : 'var(--shell-gap)',
            height: isMobile ? '100%' : 'calc(100% - 64px - var(--shell-gap))',
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
          pt: 'calc(64px + var(--shell-gap))',
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
