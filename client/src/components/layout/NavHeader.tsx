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
} from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import LogoutIcon from '@mui/icons-material/Logout';
import DownloadIcon from '@mui/icons-material/Download';
import MenuIcon from '@mui/icons-material/Menu';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { ThemeMode } from '../../contexts/ThemeEngineContext';

interface NavHeaderProps {
  appName: string;
  isMobile: boolean;
  themeMode: ThemeMode;
  navItems: any[];
  token: string | null;
  isPlatformManaged: boolean;
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
  updateAvailable,
  updateTooltip,
  onLogout,
  toggleDrawer,
  APP_BAR_TOGGLE_SIZE,
}) => {
  const location = useLocation();

  const [anchorEl, setAnchorEl] = useState<{ [key: string]: HTMLElement | null }>({});
  const hoverTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout | null }>({});

  const isLinear = themeMode === 'linear';
  const isNeumorphic = themeMode === 'neumorphic';
  const isFlat = themeMode === 'flat';
  const isTopNav = isLinear || isNeumorphic || isFlat;

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        backgroundColor: isLinear ? 'rgba(5, 5, 6, 0.8)' : isFlat ? '#FFFFFF' : 'background.paper',
        backdropFilter: isLinear ? 'blur(12px)' : 'none',
        border: isLinear || isFlat || isNeumorphic ? 'none' : 'var(--appbar-border)',
        borderBottom: isLinear ? '1px solid rgba(255, 255, 255, 0.1)' : isFlat ? '1px solid #E5E7EB' : 'var(--appbar-border)',
        boxShadow: isLinear || isFlat || isNeumorphic ? 'none' : 'var(--appbar-shadow)',
        backgroundImage: isLinear || isFlat || isNeumorphic ? 'none' : 'var(--appbar-pattern)',
        backgroundSize: '24px 24px',
        color: 'text.primary',
        zIndex: (theme) => theme.zIndex.drawer + 1,
        top: isMobile || isTopNav ? 0 : 'var(--shell-gap)',
        left: isMobile || isTopNav ? 0 : 'var(--shell-gap)',
        right: isMobile || isTopNav ? 0 : 'var(--shell-gap)',
        width: isMobile || isTopNav ? '100vw' : 'calc(100vw - (var(--shell-gap) * 2))',
        borderRadius: isTopNav ? 0 : 3,
        overflow: 'visible',
      }}
    >
      <Toolbar sx={{ gap: 2, px: { xs: 1.5, sm: 2 }, minHeight: 64, alignItems: 'center' }}>
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

        <Box sx={{ display: 'flex', alignItems: 'center', height: APP_BAR_TOGGLE_SIZE, minWidth: 0, mr: isTopNav ? 4 : 0 }}>
          <Typography
            variant="h6"
            component="span"
            sx={{
              fontWeight: isFlat ? 800 : 700,
              fontFamily: 'Outfit',
              whiteSpace: 'nowrap',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              lineHeight: `${APP_BAR_TOGGLE_SIZE}px`,
              fontSize: '1.35rem',
              color: isLinear ? '#fff' : 'inherit',
              letterSpacing: isFlat ? '-0.02em' : 'normal',
            }}
          >
            {appName}
          </Typography>
        </Box>

        {isTopNav && !isMobile && (
          <Box sx={{ display: 'flex', gap: isFlat ? 1 : 1, alignItems: 'center' }}>
            {navItems.map((item) => (
              <Box
                key={item.key}
                onMouseEnter={(e) => item.subItems && handleOpenDropdown(e, item.key)}
                onMouseLeave={() => item.subItems && handleCloseDropdown(item.key)}
                sx={{ position: 'relative' }}
              >
                <Button
                  component={RouterLink}
                  to={item.to}
                  variant="text"
                  startIcon={item.icon}
                  endIcon={item.subItems ? <KeyboardArrowDownIcon sx={{ fontSize: '1rem', ml: -0.5, opacity: 0.5 }} /> : null}
                  sx={{
                    color: location.pathname.startsWith(item.to) 
                      ? (isLinear ? '#fff' : '#111827') 
                      : (isLinear ? 'rgba(255, 255, 255, 0.6)' : '#6B7280'),
                    fontWeight: isFlat ? 800 : 600,
                    fontSize: '0.85rem',
                    textTransform: 'none',
                    px: isFlat ? 2 : 1.5,
                    py: 1,
                    borderRadius: isFlat ? 1 : 1.5,
                    '&:hover': {
                      color: isLinear ? '#fff' : '#111827',
                      bgcolor: isLinear ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                      transform: isFlat ? 'scale(1.05)' : 'none',
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
                    anchorEl={anchorEl[item.key]}
                    open={Boolean(anchorEl[item.key])}
                    onClose={() => setAnchorEl((prev) => ({ ...prev, [item.key]: null }))}
                    MenuListProps={{
                      onMouseEnter: () => keepDropdownOpen(item.key),
                      onMouseLeave: () => handleCloseDropdown(item.key),
                      sx: { 
                        py: 1, 
                        px: 1, 
                        bgcolor: isLinear ? '#050506' : '#FFFFFF', 
                        border: isLinear ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #E5E7EB', 
                        borderRadius: isFlat ? 1 : 2 
                      }
                    }}
                    TransitionComponent={Fade}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    elevation={isFlat ? 0 : 8}
                    sx={{
                      '& .MuiPaper-root': {
                        bgcolor: 'transparent',
                        boxShadow: isLinear ? '0 8px 32px rgba(0,0,0,0.8)' : isFlat ? 'none' : '0 8px 16px rgba(0,0,0,0.12)',
                        mt: 1,
                      }
                    }}
                  >
                    {item.subItems.map((subItem: any) => (
                      <MenuItem
                        key={subItem.key}
                        component={RouterLink}
                        to={subItem.to}
                        onClick={() => setAnchorEl((prev) => ({ ...prev, [item.key]: null }))}
                        sx={{
                          borderRadius: isFlat ? 0.5 : 1,
                          fontSize: '0.85rem',
                          fontWeight: isFlat ? 700 : 500,
                          color: location.pathname === subItem.to 
                            ? (isLinear ? '#fff' : '#3B82F6') 
                            : (isLinear ? 'rgba(255, 255, 255, 0.6)' : '#6B7280'),
                          '&:hover': {
                            color: isLinear ? '#fff' : (isFlat ? '#111827' : '#3B82F6'),
                            bgcolor: isLinear ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                          },
                          py: 1,
                          minWidth: 160,
                        }}
                      >
                        {subItem.label}
                      </MenuItem>
                    ))}
                  </Menu>
                )}
              </Box>
            ))}
          </Box>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {token && !isPlatformManaged && updateAvailable && updateTooltip && (
          <Tooltip title={updateTooltip} placement="bottom" arrow>
            <IconButton
              aria-label="new version available"
              sx={{
                color: 'common.white',
                bgcolor: 'warning.main',
                borderRadius: isFlat ? 1 : '50%',
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
          <IconButton aria-label="logout" onClick={onLogout} sx={{ color: isLinear ? '#fff' : 'text.primary' }}>
            <LogoutIcon />
          </IconButton>
        )}
      </Toolbar>
    </AppBar>
  );
};
