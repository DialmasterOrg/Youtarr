import React from 'react';
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
} from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { StorageFooterWidget } from './StorageFooterWidget';

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
  token,
  onCloseMobile,
}) => {
  const location = useLocation();
  const drawerWidth = isMobile ? EXPANDED_WIDTH : collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
  const isNavCollapsed = !isMobile && collapsed;
  const iconBoxSize = NAV_ICON_SIZE;

  const collapsedVersionLabel = React.useMemo(() => {
    if (!versionLabel) return '';
    return versionLabel.split('•')[0].trim();
  }, [versionLabel]);

  const displayVersionLabel = isNavCollapsed ? collapsedVersionLabel : (versionLabel || '');

  if (isTopNav && !isMobile) {
    return null;
  }

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
                    if (isMobile) onCloseMobile();
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
                    {item.subItems.map((subItem: any) => {
                      const subSelected = location.pathname === subItem.to;
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
      </Box>

      <StorageFooterWidget token={token} collapsed={collapsed} />

      <Box sx={{ height: 8 }} />
    </Box>
  );

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'permanent'}
      open={isMobile ? drawerOpenMobile : true}
      onClose={onCloseMobile}
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
  );
};
