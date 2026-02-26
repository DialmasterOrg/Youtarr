import React, { useEffect, useState } from 'react';
import {
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  Collapse,
  Paper,
} from '../ui';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { Download as DownloadIcon } from '../../lib/icons';
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
const NAV_DRAWER_DESKTOP_MAX_HEIGHT = 'calc(100vh - (80px + var(--shell-gap)) - (var(--shell-gap) * 2))';
const NAV_DRAWER_MOBILE_TOP_OFFSET = 'calc(60px + var(--shell-gap))';
const NAV_DRAWER_MOBILE_BOTTOM_GAP = 'var(--shell-gap)';
const NAV_DRAWER_MOBILE_MAX_HEIGHT = 'calc(100vh - (60px + (var(--shell-gap) * 2)))';

// MUI spacing helper: 1 unit = 8px
const sp = (n: number) => `${n * 8}px`;

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
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Track expanded menu items on mobile
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const activeItem = navItems.find((item) =>
      item.subItems?.some((subItem: any) => location.pathname === subItem.to || location.pathname.startsWith(subItem.to + '/'))
    );

    if (activeItem?.key) {
      setExpandedItems((prev) => ({ ...prev, [activeItem.key]: true }));
    }
  }, [location.pathname, navItems]);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
        <List
          style={{
            paddingLeft: isCompactStorage ? 10 : 0,
            paddingRight: isCompactStorage ? 10 : 0,
            paddingTop: isCompactStorage ? 8 : 4,
            gap: `${NAV_MAIN_GAP * 8}px`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {navItems.map((item) => {
            const hasSubMatch = item.subItems?.some((subItem: any) => (
              location.pathname === subItem.to || location.pathname.startsWith(subItem.to + '/')
            ));
            const selected = location.pathname === item.to || location.pathname.startsWith(item.to + '/') || Boolean(hasSubMatch);
            const isExpanded = isMobile
              ? expandedItems[item.key] || selected
              : !isNavCollapsed && Boolean(item.subItems) && selected;
            const isHovered = hoveredItem === item.key;

            const button = (
              <div key={item.key} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 0, paddingBottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                <ListItemButton
                  component={RouterLink}
                  to={item.to}
                  selected={selected}
                  onClick={(e: React.MouseEvent) => {
                    if (isMobile && item.subItems) {
                      toggleExpand(item.key, e);
                    } else if (isMobile) {
                      onCloseMobile();
                    }
                  }}
                  onMouseEnter={() => setHoveredItem(item.key)}
                  onMouseLeave={() => setHoveredItem(null)}
                  style={{
                    borderRadius: 'var(--radius-ui)',
                    justifyContent: isNavCollapsed ? 'center' : 'flex-start',
                    alignItems: 'center',
                    paddingLeft: isNavCollapsed ? NAV_COLLAPSED_HORIZONTAL_PADDING * 8 : NAV_EXPANDED_HORIZONTAL_PADDING * 8,
                    paddingRight: isNavCollapsed ? NAV_COLLAPSED_HORIZONTAL_PADDING * 8 : NAV_EXPANDED_HORIZONTAL_PADDING * 8,
                    paddingTop: 0,
                    paddingBottom: 0,
                    minHeight: NAV_MAIN_MIN_HEIGHT,
                    height: NAV_MAIN_MIN_HEIGHT,
                    width: '100%',
                    border: selected ? 'var(--nav-item-border-selected)' : (isPlayful && isHovered ? 'var(--nav-item-border-selected)' : 'var(--nav-item-border)'),
                    backgroundColor: selected ? 'var(--nav-item-bg-selected)' : (isPlayful && isHovered ? 'var(--nav-item-bg-hover)' : 'var(--nav-item-bg)'),
                    color: selected ? 'var(--nav-item-text-selected)' : 'inherit',
                    boxShadow: selected ? 'var(--nav-item-shadow-selected)' : (isPlayful && isHovered ? 'var(--shadow-soft)' : 'var(--nav-item-shadow)'),
                    transition: 'all 300ms var(--transition-bouncy)',
                    cursor: 'pointer',
                  }}
                >
                  <ListItemIcon
                    style={{
                      minWidth: iconBoxSize,
                      width: iconBoxSize,
                      height: iconBoxSize,
                      flex: `0 0 ${iconBoxSize}px`,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      color: selected ? 'var(--nav-item-text-selected)' : 'inherit',
                      flexShrink: 0,
                      marginRight: isNavCollapsed ? 0 : NAV_ICON_MARGIN * 8,
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    secondary={item.oldLabel}
                    style={{
                      opacity: isNavCollapsed ? 0 : 1,
                      maxWidth: isNavCollapsed ? 0 : '100%',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      transition: 'opacity 200ms var(--transition-bouncy), max-width 200ms var(--transition-bouncy)',
                    }}
                    primaryTypographyProps={{
                      style: {
                        fontWeight: 700,
                        fontSize: NAV_PRIMARY_FONT_SIZE,
                        lineHeight: NAV_PRIMARY_LINE_HEIGHT,
                      },
                      noWrap: true,
                    }}
                    secondaryTypographyProps={{
                      variant: 'caption',
                      style: {
                        fontWeight: 300,
                        fontSize: NAV_SECONDARY_FONT_SIZE,
                        lineHeight: NAV_SECONDARY_LINE_HEIGHT,
                        marginTop: '1px',
                        color: selected ? 'var(--nav-item-text-selected)' : undefined,
                      },
                      noWrap: true,
                    }}
                  />
                </ListItemButton>
                
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  {item.subItems && (
                    <List disablePadding style={{ marginTop: NAV_SUB_VERTICAL_GAP * 8, display: 'flex', flexDirection: 'column', gap: `${NAV_SUB_VERTICAL_GAP * 8}px` }}>
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
                            style={{
                              borderRadius: 'var(--radius-ui)',
                              paddingLeft: 0,
                              paddingRight: NAV_SUB_PADDING_RIGHT * 8,
                              paddingTop: 0,
                              paddingBottom: 0,
                              minHeight: NAV_SUB_MIN_HEIGHT,
                              height: NAV_SUB_MIN_HEIGHT,
                              width: '100%',
                              marginLeft: sp(NAV_SUB_TEXT_INDENT),
                              marginRight: 2,
                              border: subSelected ? 'var(--nav-item-border-selected)' : 'var(--nav-item-border)',
                              backgroundColor: subSelected ? 'var(--nav-item-bg-selected)' : 'var(--nav-item-bg)',
                              boxShadow: subSelected ? 'var(--nav-item-shadow-selected)' : 'var(--nav-item-shadow)',
                              color: subSelected ? 'var(--nav-item-text-selected)' : 'inherit',
                            }}
                          >
                            <ListItemText
                              primary={subItem.label}
                              style={{
                                minWidth: 0,
                                paddingLeft: sp(NAV_SUB_HIGHLIGHT_LEFT_PADDING),
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                              }}
                              primaryTypographyProps={{
                                variant: 'body2',
                                style: {
                                  fontWeight: subSelected ? 600 : 400,
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
              </div>
            );

            if (!isNavCollapsed) return button;

            return (
              <Tooltip key={item.key} title={`${item.label} — ${item.oldLabel}`} placement="right" arrow>
                {button}
              </Tooltip>
            );
          })}
        </List>
      </div>

      {!isNavCollapsed && !isCompactStorage && <Divider style={{ marginTop: 8, marginBottom: 8 }} />}

      {!isCompactStorage && (
        <div style={{ paddingLeft: collapsed ? 8 : 16, paddingRight: collapsed ? 8 : 16, paddingBottom: 4, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: isNavCollapsed ? 'center' : 'flex-start', gap: 4 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              style={{
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
                <DownloadIcon size={11} style={{ color: 'var(--warning, orange)' }} />
              </Tooltip>
            )}
          </div>
        </div>
      )}

      {isCompactStorage ? (
        <div
          style={{
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Typography variant="caption" color="text.secondary" style={{ fontWeight: 600 }}>
              {versionLabel || 'yt-dlp'}
            </Typography>
            {ytDlpUpdateAvailable && ytDlpUpdateTooltip && (
              <Tooltip title={ytDlpUpdateTooltip} placement="top" arrow>
                <DownloadIcon size={11} style={{ color: 'var(--warning, orange)' }} />
              </Tooltip>
            )}
          </div>
          <StorageFooterWidget
            token={token}
            collapsed={collapsed}
            compact
            inline
            justify="flex-end"
          />
        </div>
      ) : (
        <StorageFooterWidget token={token} collapsed={collapsed} />
      )}

      <div style={{ height: 8 }} />
    </div>
  );

  // --- MOBILE SPECIFIC RENDERING ---

  // 1. Playful Bottom Navigation
  if (isMobile && isPlayful) {
    const activeIndex = navItems.findIndex(item => location.pathname === item.to || location.pathname.startsWith(item.to + '/'));
    return (
      <Paper
        elevation={3}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1300,
          paddingBottom: 'env(safe-area-inset-bottom)',
          borderRadius: 'var(--radius-ui) var(--radius-ui) 0 0',
          borderTop: 'var(--nav-border)',
          backgroundColor: 'var(--card)',
          overflow: 'hidden',
        }}
      >
        <nav style={{ display: 'flex', height: 64, backgroundColor: 'transparent' }}>
          {navItems.map((item, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.to)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
                  padding: '4px 0',
                  transition: 'color 0.2s',
                }}
              >
                {React.cloneElement(item.icon as React.ReactElement, {
                  size: isActive ? 26 : 22,
                  style: { transition: 'all 0.2s' },
                })}
                <span style={{ fontSize: '0.65rem', lineHeight: 1 }}>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </Paper>
    );
  }

  // 2. Neumorphic Floating Pod
  if (isMobile && isNeumorphic) {
    const activePodItem = navItems.find((item) => expandedItems[item.key]);
    return (
      <div
        style={{
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
            style={{
              position: 'fixed',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: 'calc(72px + env(safe-area-inset-bottom))',
              width: '88%',
              maxWidth: 360,
              borderRadius: 'var(--radius-ui)',
              padding: 6,
              backgroundColor: 'var(--card)',
              border: 'var(--nav-border)',
              boxShadow: 'var(--nav-shadow)',
              zIndex: 1301,
              maxHeight: '45vh',
              overflowY: 'auto',
            }}
          >
            <List
              disablePadding
              style={{ paddingLeft: 2, paddingRight: 2, display: 'flex', flexDirection: 'column', gap: 4 }}
            >
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
                    style={{
                      borderRadius: 'var(--radius-ui)',
                      minHeight: 32,
                      paddingLeft: 8,
                      paddingRight: 8,
                      border: subSelected ? 'var(--nav-item-border-selected)' : 'var(--nav-item-border)',
                      backgroundColor: subSelected ? 'var(--nav-item-bg-selected)' : 'var(--nav-item-bg)',
                      boxShadow: subSelected ? 'var(--nav-item-shadow-selected)' : 'var(--nav-item-shadow)',
                      color: subSelected ? 'var(--nav-item-text-selected)' : 'inherit',
                    }}
                  >
                    <ListItemText
                      primary={subItem.label}
                      primaryTypographyProps={{
                        variant: 'body2',
                        style: {
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
          style={{
            borderRadius: 'var(--radius-ui)',
            padding: 4,
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            backgroundColor: 'var(--card)',
            border: 'var(--nav-border)',
            boxShadow: 'var(--nav-shadow)',
          }}
        >
          {navItems.map((item) => {
            const selected = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
            return (
              <div
                key={item.key}
                onClick={() => {
                  if (item.subItems) {
                    toggleExclusiveExpand(item.key);
                  } else {
                    setExpandedItems({});
                    navigate(item.to);
                  }
                }}
                style={{
                  padding: 8,
                  borderRadius: 'var(--radius-ui)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: selected ? 'var(--nav-item-border-selected)' : 'var(--nav-item-border)',
                  backgroundColor: selected ? 'var(--nav-item-bg-selected)' : 'var(--nav-item-bg)',
                  boxShadow: selected ? 'var(--nav-item-shadow-selected)' : 'var(--nav-item-shadow)',
                  color: selected ? 'var(--nav-item-text-selected)' : 'inherit',
                }}
              >
                {React.cloneElement(item.icon as React.ReactElement, { size: 24 })}
              </div>
            );
          })}
        </Paper>
      </div>
    );
  }

  // 3. Desktop or Industrial Mobile Drawer
  const drawerBorderRadius = isMobile && isLinearFlat
    ? 'var(--radius-ui) var(--radius-ui) 0 0'
    : NAV_DRAWER_BORDER_RADIUS;

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    borderRadius: drawerBorderRadius,
    border: 'var(--nav-border)',
    boxShadow: 'var(--nav-shadow)',
    backgroundColor: 'var(--card)',
    marginTop: isMobile && isLinearFlat ? 'auto' : isMobile ? NAV_DRAWER_MOBILE_TOP_OFFSET : NAV_DRAWER_DESKTOP_TOP_OFFSET,
    marginBottom: isMobile && isLinearFlat ? 0 : isMobile ? NAV_DRAWER_MOBILE_BOTTOM_GAP : 'var(--shell-gap)',
  marginLeft: isMobile ? 0 : 'var(--shell-gap)',
    marginRight: isMobile ? 0 : 'var(--shell-gap)',
    paddingLeft: isMobile ? 0 : 4,
    paddingRight: isMobile ? 0 : 4,
    maxHeight: isMobile && isLinearFlat ? '65vh' : isMobile ? NAV_DRAWER_MOBILE_MAX_HEIGHT : NAV_DRAWER_DESKTOP_MAX_HEIGHT,
    overflow: 'hidden',
    overflowX: 'hidden',
    width: isMobile && isLinearFlat ? '100%' : drawerWidth,
    boxSizing: 'border-box',
    transition: 'width 300ms var(--transition-bouncy), padding 300ms var(--transition-bouncy)',
    top: isMobile && isLinearFlat ? 'auto' : 0,
    left: isMobile && isLinearFlat ? 0 : undefined,
    right: isMobile && isLinearFlat ? 0 : undefined,
    bottom: isMobile && isLinearFlat ? 0 : isMobile ? undefined : 'var(--shell-gap)',
    zIndex: 1200,
  };

  // Mobile temporary drawer
  if (isMobile) {
    return (
      <>
        {drawerOpenMobile && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1199,
              backgroundColor: 'rgba(0,0,0,0.5)',
            }}
            onClick={onCloseMobile}
          />
        )}
        {drawerOpenMobile && (
          <div className="app-nav-paper neumo-breathe" style={panelStyle}>
            {drawerContent}
          </div>
        )}
      </>
    );
  }

  // Desktop permanent drawer
  return (
    <div className="app-nav-paper neumo-breathe" style={panelStyle}>
      {drawerContent}
    </div>
  );
};
