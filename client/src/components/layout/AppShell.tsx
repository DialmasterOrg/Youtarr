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

  useEffect(() => {
    const navWidth = isMobile ? 0 : collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
    document.documentElement.style.setProperty('--nav-width', `${navWidth}px`);
  }, [collapsed, isMobile]);

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
      <List sx={{ px: 1, pt: 0.5, gap: 0.25, display: 'flex', flexDirection: 'column' }}>
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
                justifyContent: 'flex-start',
                px: 1.5,
                py: 1,
                minHeight: 48,
                width: '100%',
                border: selected ? '2px solid var(--foreground)' : '2px solid transparent',
                bgcolor: selected ? 'var(--tertiary)' : 'transparent',
                color: 'text.primary',
                boxShadow: selected ? 'var(--shadow-hard)' : 'none',
                transition: 'all 300ms var(--transition-bouncy)',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: selected ? 'var(--tertiary)' : 'var(--muted)',
                  transform: selected ? 'translate(-2px, -2px)' : 'translate(0, 0)',
                  boxShadow: selected ? 'var(--shadow-hard-hover)' : 'none',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 44,
                  width: 44,
                  height: 44,
                  flex: '0 0 44px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: 'text.primary',
                  flexShrink: 0,
                  '& svg': { fontSize: 22 },
                }}
              >
                {item.icon}
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary={item.label}
                  secondary={item.oldLabel}
                  primaryTypographyProps={{ sx: { transition: 'opacity 200ms var(--transition-bouncy)' } }}
                  secondaryTypographyProps={{ 
                    variant: 'caption', 
                    color: 'text.secondary',
                    sx: { transition: 'opacity 200ms var(--transition-bouncy)' }
                  }}
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
        gap: 2,
        minHeight: '100vh',
        position: 'relative',
        bgcolor: 'background.default',
        background: `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 55%, ${theme.palette.background.default} 100%)`,
      }}
    >
      <CssBaseline />

      <Box
        aria-hidden
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
          borderBottom: `2px solid ${theme.palette.divider}`,
          boxShadow: 'var(--shadow-hard)',
          color: 'text.primary',
          zIndex: theme.zIndex.drawer + 1,
          backgroundImage: `radial-gradient(var(--dot-grid) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          width: '100%',
        }}
      >
        <Toolbar sx={{ gap: 2, px: { xs: 1.5, sm: 2 } }}>
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
        sx={{
          width: isMobile ? 0 : 'var(--nav-width)',
          flexShrink: 0,
          transition: 'width 300ms var(--transition-bouncy)',
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '2px solid var(--foreground)',
            boxShadow: 'var(--shadow-hard)',
            bgcolor: 'background.paper',
            overflowX: 'hidden',
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
          pt: 10,
          pb: 4,
          px: 2,
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
