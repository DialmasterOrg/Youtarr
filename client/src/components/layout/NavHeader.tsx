import React, { useState, useEffect, useMemo } from 'react';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Paper,
  Fade,
  Popper,
  ClickAwayListener,
  useTheme,
  SxProps,
  Theme,
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

  // --- State ---
  // We strictly track the active key for the single-unit hover architecture
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  // --- Theme Computed Values ---
  const isLinear = themeMode === 'linear';
  const isFlat = themeMode === 'flat';
  const isNeumorphic = themeMode === 'neumorphic';
  const isTopNav = isLinear || isFlat || isNeumorphic;
  const showTopNavItems = isTopNav && !isMobile;
  const navTextPrimary = theme.palette.text.primary;
  const navTextSecondary = theme.palette.text.secondary;

  const versionParts = useMemo(() => {
    if (!versionLabel) return [] as string[];
    return versionLabel.split('•').map((part) => part.trim()).filter(Boolean);
  }, [versionLabel]);

  // --- Effects ---
  
  // Close dropdown on route change
  useEffect(() => {
    setActiveKey(null);
    setAnchorEl(null);
  }, [location.pathname]);

  // --- Event Handlers (Single Unit Hover) ---

  const handleUnitEnter = (event: React.MouseEvent<HTMLElement>, key: string) => {
    // Only capture the 'wrapper' or 'button' as anchor.
    // We use the currentTarget (the wrapper Box) to ensure alignment is predictable
    setAnchorEl(event.currentTarget);
    setActiveKey(key);
  };

  const handleUnitLeave = () => {
    setActiveKey(null);
    setAnchorEl(null);
  };

  // --- Styles Helper ---

  const getButtonSx = (isParentActive: boolean, isOpen: boolean): SxProps<Theme> => {
    const activeColor = (isLinear || isFlat) ? theme.palette.primary.main : navTextPrimary;
    const hoverBg = isLinear ? 'rgba(255, 255, 255, 0.05)' : isFlat ? 'rgba(59, 130, 246, 0.08)' : 'rgba(0, 0, 0, 0.04)';

    return {
      color: isParentActive ? activeColor : navTextSecondary,
      fontWeight: 600,
      fontSize: '0.85rem',
      textTransform: 'none',
      px: 1.5,
      py: 1,
      borderRadius: 'var(--radius-ui)',
      position: 'relative',
      transition: 'all 0.15s ease-out', // Snappier transition

      // Indicator line
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
        pointerEvents: 'none', 
      } : {},

      // THE INVISIBLE BRIDGE (pseudo-element on the button to bridge the gap to the menu)
      // This ensures that moving the mouse downwards doesn't trigger a "leave" before entering the Popper
      '&::before': {
        content: '""',
        position: 'absolute',
        bottom: -10, // Extend 10px down to bridge the gap
        left: 0,
        width: '100%',
        height: '20px',
        bgcolor: 'transparent',
        zIndex: 1,
        display: isOpen ? 'block' : 'none', 
      },

      '&:hover': {
        color: activeColor,
        bgcolor: hoverBg,
      },
      // Force hover state when open
      ...(isOpen && {
        color: activeColor,
        bgcolor: hoverBg,
      }),

      '& .MuiButton-startIcon': {
        mr: 0.8,
        '& svg': { fontSize: '1.2rem' }
      }
    };
  };

  const menuPaperSx: SxProps<Theme> = {
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
    boxShadow: isLinear ? '0 10px 40px rgba(0,0,0,0.5)' : isFlat ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' : 'none',
    mt: 0, 
    px: 0.5,
    py: 0.5,
  };

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
        
        {/* Toggle (Mobile/Side) */}
        {(!isTopNav || isMobile) && (
          <IconButton
            className="pop-toggle"
            aria-label="toggle navigation"
            onClick={toggleDrawer}
            sx={{
              width: isTopNav ? undefined : APP_BAR_TOGGLE_SIZE,
              height: isTopNav ? undefined : APP_BAR_TOGGLE_SIZE,
              p: isTopNav ? 1 : 0,
              borderRadius: isTopNav ? 'var(--radius-ui)' : '50%',
              color: isLinear ? '#FFFFFF' : isFlat ? '#111827' : 'inherit',
              mr: isTopNav ? 1 : 0,
            }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* Title */}
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
              '&:hover': { opacity: 0.8 },
            }}
          >
            {appName}
          </Typography>
        </Box>

        {/* Desktop Navigation - The "Single Unit" Architecture */}
        {showTopNavItems && (
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 1
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
                  // THE PARENT CONTAINER
                  // Hovering this unit enables the menu.
                  // Since the Popper is a child (via disablePortal), hovering the Popper counts as hovering this Box.
                  onMouseEnter={(e) => hasSubItems && handleUnitEnter(e, item.key)}
                  onMouseLeave={handleUnitLeave}
                  sx={{ 
                    position: 'relative', 
                    height: 'auto',
                    display: 'flex', 
                    alignItems: 'center' 
                  }}
                >
                  <Button
                    component={RouterLink}
                    to={item.to}
                    variant="text"
                    startIcon={item.icon}
                    // IMPORTANT: We do NOT prevent default.
                    // Click always works (Navigation). Hover handles visibility.
                    sx={getButtonSx(isParentActive, isOpen)}
                  >
                    {item.label}
                  </Button>

                  {hasSubItems && (
                     <Popper
                     open={isOpen}
                     anchorEl={anchorEl}
                     placement="bottom-start"
                     transition
                     disablePortal // CRITICAL: Keeps the DOM hierarchy so mouseLeave on parent works for the menu too
                     modifiers={[
                       {
                         name: 'offset',
                         options: {
                           offset: [0, 8], // The visual gap
                         },
                       },
                       {
                         name: 'preventOverflow',
                         options: {
                           padding: 8,
                           boundary: 'viewport',
                         },
                       },
                     ]}
                     style={{ zIndex: theme.zIndex.modal }} // Ensure it's above other things
                   >
                     {({ TransitionProps }) => (
                       <Fade {...TransitionProps} timeout={150}>
                         <Paper sx={menuPaperSx}>
                           {item.subItems.map((subItem: any) => (
                             <Typography
                               key={subItem.key}
                               component={RouterLink}
                               to={subItem.to}
                               onClick={() => {
                                 // Close on click, but let router handle nav
                                 handleUnitLeave();
                               }}
                               sx={{
                                 display: 'block',
                                 textDecoration: 'none',
                                 width: '100%',
                                 borderRadius: (isLinear || isFlat) ? '6px' : 'var(--radius-ui)',
                                 fontSize: '0.85rem',
                                 fontWeight: 500,
                                 color: location.pathname === subItem.to ? ((isLinear || isFlat) ? theme.palette.primary.main : navTextPrimary) : navTextSecondary,
                                 px: 1.5,
                                 py: 1,
                                 boxSizing: 'border-box',
                                 transition: 'all 0.1s ease',
                                 '&:hover': {
                                   color: (isLinear || isFlat) ? theme.palette.primary.main : navTextPrimary,
                                   bgcolor: isLinear ? 'rgba(255, 255, 255, 0.08)' : isFlat ? '#F3F4F6' : '#F3F4F6',
                                 },
                               }}
                             >
                               {subItem.label}
                             </Typography>
                           ))}
                         </Paper>
                       </Fade>
                     )}
                   </Popper>
                  )}
                </Box>
              );
            })}
          </Box>
        )}

        {/* Spacer */}
        {!showTopNavItems && <Box sx={{ flexGrow: 1 }} />}

        {/* Right Actions */}
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
                  '&:hover': { bgcolor: 'warning.dark' },
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
