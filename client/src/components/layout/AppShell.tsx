import React, { useMemo, useState } from 'react';
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
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import SubscriptionsIcon from '@mui/icons-material/Subscriptions';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import DownloadIcon from '@mui/icons-material/Download';
import SettingsIcon from '@mui/icons-material/Settings';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { StorageFooterWidget } from './StorageFooterWidget';

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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [drawerOpenMobile, setDrawerOpenMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const drawerWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

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
        },
        {
          key: 'settings' as const,
          label: 'Settings',
          oldLabel: 'Configuration',
          icon: <SettingsIcon />,
          to: '/settings',
        },
      ],
    []
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
      <Toolbar />
      <List sx={{ px: 1, pt: 0.5, gap: 0.5, display: 'flex', flexDirection: 'column' }}>
        {navItems.map((item) => {
          const selected = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
          const button = (
            <ListItemButton
              key={item.key}
              component={RouterLink}
              to={item.to}
              selected={selected}
              onClick={() => {
                if (isMobile) setDrawerOpenMobile(false);
              }}
              sx={{
                borderRadius: 2,
                justifyContent: collapsed ? 'center' : 'flex-start',
                px: collapsed ? 1.25 : 2,
                py: 1,
              }}
            >
              <ListItemIcon sx={{ minWidth: collapsed ? 0 : 40, justifyContent: 'center' }}>
                {item.icon}
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary={item.label}
                  secondary={item.oldLabel}
                  secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                />
              )}
            </ListItemButton>
          );

          if (!collapsed) return button;

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
        minHeight: '100vh',
        bgcolor: 'background.default',
        background: `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 55%, ${theme.palette.background.default} 100%)`,
      }}
    >
      <CssBaseline />

      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          borderBottom: `1px solid ${theme.palette.divider}`,
          zIndex: theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton edge="start" color="inherit" aria-label="toggle navigation" onClick={toggleDrawer}>
            <MenuIcon />
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
            <Typography variant="h6" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
              {appName}
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {token && !isPlatformManaged && onLogout && (
            <IconButton color="inherit" aria-label="logout" onClick={onLogout}>
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
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: `1px solid ${theme.palette.divider}`,
            overflowX: 'hidden',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: '100%',
          px: { xs: 2, md: 4 },
          pt: 10,
          pb: 4,
          ml: isMobile ? 0 : `${drawerWidth}px`,
          maxWidth: isMobile ? '100%' : `calc(100% - ${drawerWidth}px)`,
          boxSizing: 'border-box',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
