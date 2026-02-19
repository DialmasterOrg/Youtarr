import React, { useState } from 'react';
import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  Collapse,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
} from '@mui/material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import DownloadIcon from '@mui/icons-material/Download';
import { StorageFooterWidget } from './StorageFooterWidget';
import { useThemeEngine } from '../../contexts/ThemeEngineContext';

const EXPANDED_WIDTH = 200;
const COLLAPSED_WIDTH = 65;

const NAV_MAIN_MIN_HEIGHT = 40;
const NAV_SUB_MIN_HEIGHT = 20;
const NAV_EXPANDED_HORIZONTAL_PADDING = 1.55;
const NAV_COLLAPSED_HORIZONTAL_PADDING = 1.55;
const NAV_ICON_SIZE = 25;
const NAV_ICON_MARGIN = 0.35;
const NAV_PRIMARY_FONT_SIZE = '0.85rem';
const NAV_PRIMARY_LINE_HEIGHT = 1.15;
const NAV_SECONDARY_FONT_SIZE = '0.65rem';
const NAV_SECONDARY_LINE_HEIGHT = 1.1;
const NAV_MAIN_GAP = 0.75;
const NAV_SUB_VERTICAL_GAP = 0.75;
const NAV_SUB_PADDING_RIGHT = 2;
const NAV_SUB_TEXT_INDENT = 3.5;
const NAV_SUB_HIGHLIGHT_LEFT_PADDING = 1.25;
const NAV_SUB_FONT_SIZE = '0.8rem';
const NAV_SUB_LINE_HEIGHT = 1.2;
const NAV_DRAWER_BORDER_RADIUS = 'var(--nav-radius)';
const NAV_DRAWER_DESKTOP_TOP_OFFSET = 'calc(80px + var(--shell-gap))';
const NAV_DRAWER_DESKTOP_BOTTOM_GAP = 'var(--shell-gap)';
const NAV_DRAWER_DESKTOP_MAX_HEIGHT = 'calc(100vh - (80px + var(--shell-gap)) - var(--shell-gap))';
const NAV_DRAWER_MOBILE_TOP_OFFSET = 'calc(60px + var(--shell-gap))';
const NAV_DRAWER_MOBILE_BOTTOM_GAP = 'var(--shell-gap)';
const NAV_DRAWER_MOBILE_MAX_HEIGHT = 'calc(100vh - (60px + (var(--shell-gap) * 2)))';

interface NavSidebarProps {
  isMobile: boolean;
  isTopNav: boolean;
  drawerOpenMobile: boolean;
  collapsed: boolean;
  navItems: any[];
  versionLabel?: string;
  ytDlpUpdateAvailable?: boolean;
  ytDlpUpdateTooltip?: string;
  token: string | null;
  onCloseMobile: () => void;
}

export const NavSidebar: React.FC<NavSidebarProps> = ({
  isMobile,
  isTopNav,
  drawerOpenMobile,
  collapsed,
  navItems,
  versionLabel,
  ytDlpUpdateAvailable = false,
  ytDlpUpdateTooltip,
  token,
  onCloseMobile,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { themeMode } = useThemeEngine();
  const isPlayful = themeMode === 'playful';
  const isNeumorphic = themeMode === 'neumorphic';
  const isLinearFlat = themeMode === 'linear' || themeMode === 'flat';
  const isCompactStorage = isMobile && isLinearFlat;
  const drawerWidth = isMobile ? EXPANDED_WIDTH : collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
  const isNavCollapsed = !isMobile && collapsed;
  const iconBoxSize = NAV_ICON_SIZE;

  // Track expanded menu items on mobile
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleExclusiveExpand = (key: string) => {
    setExpandedItems(prev => ({ [key]: !prev[key] }));
  };

  const collapsedVersionLabel = React.useMemo(() => {
    if (!versionLabel) return '';
    return versionLabel.split('•')[0].trim();
  }, [versionLabel]);

  const displayVersionLabel = isNavCollapsed ? collapsedVersionLabel : (versionLabel || '');

  if (isTopNav && !isMobile) {
    return null;
  }

  // Common Drawer Content (used for Industrial mobile and all Desktop)
  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
        <List
          sx={{
            px: isCompactStorage ? 1.25 : 0,
            pt: isCompactStorage ? 1 : 0.5,
            gap: NAV_MAIN_GAP,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {navItems.map((item) => {
            const hasSubMatch = item.subItems?.some((subItem: any) => (
              location.pathname === subItem.to || location.pathname.startsWith(subItem.to + '/')
            ));
            const selected = location.pathname === item.to || location.pathname.startsWith(item.to + '/') || Boolean(hasSubMatch);
            const isExpanded = expandedItems[item.key] || (selected && !isNavCollapsed);

            const button = (
              <Box key={item.key} sx={{ px: 0.5, py: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                <ListItemButton
                  component={RouterLink}
                  to={item.to}
                  selected={selected}
                  onClick={(e) => {
                    if (isMobile && item.subItems) {
                      toggleExpand(item.key, e);
                    } else if (isMobile) {
                      onCloseMobile();
                    }
                  }}
                  sx={{
                    borderRadius: 'var(--radius-ui)',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    pl: isNavCollapsed ? NAV_COLLAPSED_HORIZONTAL_PADDING : NAV_EXPANDED_HORIZONTAL_PADDING,
                    pr: isNavCollapsed ? NAV_COLLAPSED_HORIZONTAL_PADDING : NAV_EXPANDED_HORIZONTAL_PADDING,
                    py: 0,
                    minHeight: NAV_MAIN_MIN_HEIGHT,
                    height: NAV_MAIN_MIN_HEIGHT,
                    width: '100%',
                    border: selected ? 'var(--nav-item-border-selected)' : 'var(--nav-item-border)',
                    bgcolor: selected ? 'var(--nav-item-bg-selected)' : 'var(--nav-item-bg)',
                    color: selected ? 'var(--nav-item-text-selected)' : 'text.primary',
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
                      color: selected ? 'var(--nav-item-text-selected)' : 'text.primary',
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
                      color: selected ? 'var(--nav-item-text-selected)' : 'text.secondary',
                      sx: {
                        fontSize: NAV_SECONDARY_FONT_SIZE,
                        lineHeight: NAV_SECONDARY_LINE_HEIGHT,
                        mt: 0.1,
                      },
                      noWrap: true,
                    }}
                  />
                  {isMobile && item.subItems && (
                    isExpanded ? <ExpandLess /> : <ExpandMore />
                  )}
                </ListItemButton>
                
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  {item.subItems && (
                    <List disablePadding sx={{ mt: NAV_SUB_VERTICAL_GAP, display: 'flex', flexDirection: 'column', gap: NAV_SUB_VERTICAL_GAP }}>
                      {item.subItems.map((subItem: any) => {
                        const subSelected = location.pathname === subItem.to || location.pathname.startsWith(subItem.to + '/');
                        return (
                          <ListItemButton
                            key={subItem.key}
                            component={RouterLink}
                            to={subItem.to}
                            selected={subSelected}
                            onClick={() => {
                              if (isMobile) onCloseMobile();
                            }}
                            sx={(theme) => ({
                              borderRadius: 'var(--radius-ui)',
                              pl: 0,
                              pr: NAV_SUB_PADDING_RIGHT,
                              py: 0,
                              minHeight: NAV_SUB_MIN_HEIGHT,
                              height: NAV_SUB_MIN_HEIGHT,
                              width: `calc(100% - ${theme.spacing(NAV_SUB_TEXT_INDENT)})`,
                              ml: theme.spacing(NAV_SUB_TEXT_INDENT),
                              border: subSelected ? 'var(--nav-item-border-selected)' : 'var(--nav-item-border)',
                              bgcolor: subSelected ? 'var(--nav-item-bg-selected)' : 'var(--nav-item-bg)',
                              boxShadow: subSelected ? 'var(--nav-item-shadow-selected)' : 'var(--nav-item-shadow)',
                              color: subSelected ? 'var(--nav-item-text-selected)' : 'text.secondary',
                              '&:hover': {
                                bgcolor: subSelected ? 'var(--nav-item-bg-selected)' : 'var(--nav-item-bg-hover)',
                                transform: subSelected ? 'var(--nav-item-transform-hover)' : 'var(--nav-item-transform)',
                                boxShadow: subSelected ? 'var(--nav-item-shadow-hover)' : 'var(--nav-item-shadow)',
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
                </Collapse>
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

      {!isNavCollapsed && !isCompactStorage && <Divider sx={{ my: 1 }} />}

      {!isCompactStorage && (
        <Box sx={{ px: collapsed ? 1 : 2, pb: 0.5, textAlign: 'left' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: isNavCollapsed ? 'center' : 'flex-start', gap: 0.5 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'block',
                whiteSpace: 'nowrap',
                overflow: isNavCollapsed ? 'visible' : 'hidden',
                textOverflow: isNavCollapsed ? 'clip' : 'ellipsis',
                textAlign: isNavCollapsed ? 'center' : 'left',
                fontSize: isNavCollapsed ? 'clamp(0.55rem, 1.6vw, 0.75rem)' : NAV_SECONDARY_FONT_SIZE,
                letterSpacing: isNavCollapsed ? '-0.01em' : 'normal',
              }}
              title={versionLabel}
            >
              {displayVersionLabel}
            </Typography>
            {ytDlpUpdateAvailable && ytDlpUpdateTooltip && (
              <Tooltip title={ytDlpUpdateTooltip} placement="right" arrow>
                <DownloadIcon sx={{ fontSize: '0.65rem', color: 'warning.main' }} />
              </Tooltip>
            )}
          </Box>
        </Box>
      )}

      {isCompactStorage ? (
        <Box
          sx={{
            px: 1.5,
            py: 0.75,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {versionLabel || 'yt-dlp'}
            </Typography>
            {ytDlpUpdateAvailable && ytDlpUpdateTooltip && (
              <Tooltip title={ytDlpUpdateTooltip} placement="top" arrow>
                <DownloadIcon sx={{ fontSize: '0.65rem', color: 'warning.main' }} />
              </Tooltip>
            )}
          </Box>
          <StorageFooterWidget
            token={token}
            collapsed={collapsed}
            compact
            inline
            justify="flex-end"
          />
        </Box>
      ) : (
        <StorageFooterWidget token={token} collapsed={collapsed} />
      )}

      <Box sx={{ height: 8 }} />
    </Box>
  );

  // --- MOBILE SPECIFIC RENDERING ---

  // 1. Playful Bottom Navigation
  if (isMobile && isPlayful) {
    return (
      <Paper 
        elevation={3} 
        sx={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          zIndex: 1300,
          pb: 'env(safe-area-inset-bottom)',
          borderRadius: 'var(--radius-ui) var(--radius-ui) 0 0',
          borderTop: 'var(--nav-border)',
          bgcolor: 'background.paper',
          overflow: 'hidden'
        }}
      >
        <BottomNavigation
          showLabels
          value={navItems.findIndex(item => location.pathname === item.to || location.pathname.startsWith(item.to + '/'))}
          onChange={(_, newValue) => {
            if (navItems[newValue]) {
              navigate(navItems[newValue].to);
            }
          }}
          sx={{ height: 64, bgcolor: 'transparent' }}
        >
          {navItems.map((item) => (
            <BottomNavigationAction
              key={item.key}
              label={item.label}
              icon={item.icon}
              sx={{
                color: 'text.secondary',
                '&.Mui-selected': {
                  color: 'primary.main',
                  '& .MuiSvgIcon-root': {
                    transform: 'scale(1.2)',
                    transition: 'transform 0.2s'
                  }
                },
              }}
            />
          ))}
        </BottomNavigation>
      </Paper>
    );
  }

  // 2. Neumorphic Floating Pod
  if (isMobile && isNeumorphic) {
    const activePodItem = navItems.find((item) => expandedItems[item.key]);
    return (
      <Box
        sx={{
          position: 'fixed',
          bottom: 'calc(8px + env(safe-area-inset-bottom))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1300,
          width: '88%',
          maxWidth: 360,
        }}
      >
        {activePodItem?.subItems && (
          <Paper
            className="neumo-breathe"
            sx={{
              position: 'fixed',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: 'calc(72px + env(safe-area-inset-bottom))',
              width: '88%',
              maxWidth: 360,
              borderRadius: 'var(--radius-ui)',
              p: 0.75,
              bgcolor: 'background.paper',
              border: 'var(--nav-border)',
              boxShadow: 'var(--nav-shadow)',
              zIndex: 1301,
              maxHeight: '45vh',
              overflowY: 'auto',
            }}
          >
            <List disablePadding sx={{ px: 0.25, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {activePodItem.subItems.map((subItem: any) => {
                const subSelected = location.pathname === subItem.to || location.pathname.startsWith(subItem.to + '/');
                return (
                  <ListItemButton
                    key={subItem.key}
                    component={RouterLink}
                    to={subItem.to}
                    selected={subSelected}
                    onClick={() => {
                      setExpandedItems({});
                    }}
                    sx={{
                      borderRadius: 'var(--radius-ui)',
                      minHeight: 32,
                      px: 1,
                      border: subSelected ? 'var(--nav-item-border-selected)' : 'var(--nav-item-border)',
                      bgcolor: subSelected ? 'var(--nav-item-bg-selected)' : 'var(--nav-item-bg)',
                      boxShadow: subSelected ? 'var(--nav-item-shadow-selected)' : 'var(--nav-item-shadow)',
                      color: subSelected ? 'var(--nav-item-text-selected)' : 'text.secondary',
                      '&:hover': {
                        bgcolor: subSelected ? 'var(--nav-item-bg-selected)' : 'var(--nav-item-bg-hover)',
                        transform: subSelected ? 'var(--nav-item-transform-hover)' : 'var(--nav-item-transform)',
                        boxShadow: subSelected ? 'var(--nav-item-shadow-hover)' : 'var(--nav-item-shadow)',
                      },
                    }}
                  >
                    <ListItemText
                      primary={subItem.label}
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
          </Paper>
        )}
        <Paper
          className="neumo-breathe"
          sx={{
            borderRadius: 'var(--radius-ui)',
            p: 0.5,
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            bgcolor: 'background.paper',
            border: 'var(--nav-border)',
            boxShadow: 'var(--nav-shadow)',
          }}
        >
          {navItems.map((item) => {
            const selected = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
            return (
              <Box
                key={item.key}
                onClick={() => {
                  if (item.subItems) {
                    toggleExclusiveExpand(item.key);
                  } else {
                    setExpandedItems({});
                    navigate(item.to);
                  }
                }}
                sx={{
                  p: 1,
                  borderRadius: 'var(--radius-ui)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: selected ? 'var(--nav-item-border-selected)' : 'var(--nav-item-border)',
                  bgcolor: selected ? 'var(--nav-item-bg-selected)' : 'var(--nav-item-bg)',
                  boxShadow: selected ? 'var(--nav-item-shadow-selected)' : 'var(--nav-item-shadow)',
                  color: selected ? 'var(--nav-item-text-selected)' : 'text.secondary',
                  '&:active': {
                    transform: 'scale(0.9)',
                  }
                }}
              >
                {React.cloneElement(item.icon as React.ReactElement, { sx: { fontSize: 24 } })}
              </Box>
            );
          })}
        </Paper>
      </Box>
    );
  }

  // 3. Desktop or Industrial Mobile Drawer
  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'permanent'}
      anchor={isMobile && isLinearFlat ? 'bottom' : 'left'}
      open={isMobile ? drawerOpenMobile : true}
      onClose={onCloseMobile}
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        className: 'app-nav-paper neumo-breathe',
        sx: {
          borderRadius: isMobile && isLinearFlat ? 'var(--radius-ui) var(--radius-ui) 0 0' : NAV_DRAWER_BORDER_RADIUS,
          borderBottomLeftRadius: isMobile && isLinearFlat ? 0 : NAV_DRAWER_BORDER_RADIUS,
          borderBottomRightRadius: isMobile && isLinearFlat ? 0 : NAV_DRAWER_BORDER_RADIUS,
          border: 'var(--nav-border)',
          boxShadow: 'var(--nav-shadow)',
          bgcolor: 'background.paper',
          mt: isMobile && isLinearFlat ? 'auto' : isMobile ? NAV_DRAWER_MOBILE_TOP_OFFSET : NAV_DRAWER_DESKTOP_TOP_OFFSET,
          mb: isMobile && isLinearFlat ? 0 : isMobile ? NAV_DRAWER_MOBILE_BOTTOM_GAP : NAV_DRAWER_DESKTOP_BOTTOM_GAP,
          ml: isMobile ? 0 : 'var(--shell-gap)',
          maxHeight: isMobile && isLinearFlat ? '65vh' : isMobile ? NAV_DRAWER_MOBILE_MAX_HEIGHT : NAV_DRAWER_DESKTOP_MAX_HEIGHT,
          overflow: 'hidden',
          overflowX: 'hidden',
        },
      }}
      sx={{
        width: isMobile ? (isLinearFlat ? '100%' : 0) : 'calc(var(--nav-width) + var(--shell-gap))',
        flexShrink: 0,
        transition: 'width 300ms var(--transition-bouncy)',
        '& .MuiDrawer-paper': {
          width: isMobile && isLinearFlat ? '100%' : drawerWidth,
          boxSizing: 'border-box',
          transition: 'width 300ms var(--transition-bouncy), padding 300ms var(--transition-bouncy)',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};
