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
import { StorageFooterWidget } from './StorageFooterWidget';
import { getThemeById } from '../../themes';
import { useThemeEngine } from '../../contexts/ThemeEngineContext';
import { NavItem, isNavItemExpanded, isNavPathActive } from './navigation';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import {
  MOBILE_NAV_PRIMARY_HEIGHT,
  MOBILE_NAV_SAFE_GAP,
  MOBILE_NAV_SECONDARY_HEIGHT,
  NAV_BUTTON_OUTER_PADDING_X,
  NAV_DRAWER_PANEL_PADDING_X,
  NAV_DRAWER_PANEL_PADDING_X_COLLAPSED,
  NAV_MAIN_BUTTON_SIDE_PADDING,
  NAV_SIDEBAR_COLLAPSED_WIDTH,
  NAV_SIDEBAR_EXPANDED_WIDTH,
} from './navLayoutConstants';

const NAV_MAIN_MIN_HEIGHT = 40;
const NAV_SUB_MIN_HEIGHT = 20;
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

// Spacing helper: 1 unit = 8px
const sp = (n: number) => `${n * 8}px`;

interface NavSidebarProps {
  isMobile: boolean;
  isTopNav: boolean;
  drawerOpenMobile: boolean;
  collapsed: boolean;
  navItems: NavItem[];
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
  const navigate = useNavigate();
  const { themeMode } = useThemeEngine();
  const sidebarBehavior = getThemeById(themeMode).sidebarBehavior;
  const isCompactHeight = useMediaQuery('(max-height: 500px)');
  const isCompactStorage = false;
  const footerShouldScroll = sidebarBehavior.compactHeightScrollFooter && isCompactHeight;
  const drawerWidth = isMobile
    ? NAV_SIDEBAR_EXPANDED_WIDTH
    : collapsed
      ? NAV_SIDEBAR_COLLAPSED_WIDTH
      : NAV_SIDEBAR_EXPANDED_WIDTH;
  const isNavCollapsed = !isMobile && collapsed;
  const drawerPanelPaddingX = isNavCollapsed ? NAV_DRAWER_PANEL_PADDING_X_COLLAPSED : NAV_DRAWER_PANEL_PADDING_X;
  const drawerPanelPaddingLeft = sidebarBehavior.zeroDesktopPanelPadding ? 0 : drawerPanelPaddingX;
  const drawerPanelPaddingRight = sidebarBehavior.zeroDesktopPanelPadding ? 0 : drawerPanelPaddingX;
  const navButtonGapLeft = sidebarBehavior.navButtonGap;
  const navButtonGapRight = sidebarBehavior.navButtonGap;
  const iconBoxSize = NAV_ICON_SIZE;
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Track expanded menu items on mobile
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const activeItem = navItems.find((item) =>
      item.subItems?.some((subItem) => isNavPathActive(location.pathname, subItem.to))
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

  const collapsedVersionLabel = React.useMemo(() => {
    if (!versionLabel) return '';
    return versionLabel.split('•')[0].trim();
  }, [versionLabel]);

  const displayVersionLabel = isNavCollapsed ? collapsedVersionLabel : (versionLabel || '');

  const activeSidebarSectionKey = React.useMemo(() => {
    const activeItem = navItems.find((item) => isNavItemExpanded(location.pathname, item));
    return activeItem?.key || null;
  }, [location.pathname, navItems]);

  const activeItem = React.useMemo(
    () => navItems.find((item) => isNavItemExpanded(location.pathname, item)) || null,
    [location.pathname, navItems]
  );

  const activeItemWithSubItems = React.useMemo(
    () => navItems.find((item) => isNavItemExpanded(location.pathname, item)) || null,
    [location.pathname, navItems]
  );

  useEffect(() => {
    const root = document.documentElement;

    if (!isMobile) {
      root.style.setProperty('--mobile-nav-primary-height', '0px');
      root.style.setProperty('--mobile-nav-secondary-height', '0px');
      root.style.setProperty('--mobile-nav-total-offset', '0px');
      root.style.setProperty('--mobile-nav-total-offset-px', '0');
      return;
    }

    const secondaryHeight = activeItemWithSubItems ? MOBILE_NAV_SECONDARY_HEIGHT : 0;
    root.style.setProperty('--mobile-nav-primary-height', `${MOBILE_NAV_PRIMARY_HEIGHT}px`);
    root.style.setProperty('--mobile-nav-secondary-height', `${secondaryHeight}px`);
    root.style.setProperty('--mobile-nav-total-offset-px', String(MOBILE_NAV_PRIMARY_HEIGHT + secondaryHeight));
    root.style.setProperty(
      '--mobile-nav-total-offset',
      `calc(${MOBILE_NAV_PRIMARY_HEIGHT}px + ${secondaryHeight}px + env(safe-area-inset-bottom))`
    );

    return () => {
      root.style.setProperty('--mobile-nav-primary-height', '0px');
      root.style.setProperty('--mobile-nav-secondary-height', '0px');
      root.style.setProperty('--mobile-nav-total-offset', '0px');
      root.style.setProperty('--mobile-nav-total-offset-px', '0');
    };
  }, [activeItemWithSubItems, isMobile]);

  if (isTopNav && !isMobile) {
    return null;
  }

  // Common Drawer Content (used for Industrial mobile and all Desktop)
  const drawerContent = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflowY: footerShouldScroll ? 'auto' : 'hidden',
      }}
    >
      <div
        style={{
          flex: footerShouldScroll ? '0 0 auto' : '1 1 auto',
          minHeight: 0,
          overflowY: footerShouldScroll ? 'visible' : 'auto',
          paddingBottom: sidebarBehavior.scrollerPaddingBottom,
        }}
      >
        <List
          style={{
            paddingLeft: isCompactStorage ? 10 : 0,
            paddingRight: isCompactStorage ? 10 : 0,
            paddingTop: isCompactStorage ? 8 : 4,
            paddingBottom: sidebarBehavior.listPaddingBottom,
            gap: `${NAV_MAIN_GAP * 8}px`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {navItems.map((item) => {
            const selected = isNavItemExpanded(location.pathname, item);
            const isExpanded = isMobile
              ? expandedItems[item.key] || selected
              : !isNavCollapsed && Boolean(item.subItems) && activeSidebarSectionKey === item.key;
            const isHovered = hoveredItem === item.key;

            const button = (
              <div
                key={item.key}
                style={{
                  paddingLeft: navButtonGapLeft,
                  paddingRight: navButtonGapRight,
                  paddingTop: 0,
                  paddingBottom: sidebarBehavior.itemPaddingBottom,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                }}
              >
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
                    paddingLeft: NAV_MAIN_BUTTON_SIDE_PADDING * 8,
                    paddingRight: NAV_MAIN_BUTTON_SIDE_PADDING * 8,
                    paddingTop: 0,
                    paddingBottom: 0,
                    minHeight: NAV_MAIN_MIN_HEIGHT,
                    height: NAV_MAIN_MIN_HEIGHT,
                    width: '100%',
                    border: selected ? 'var(--nav-item-border-selected)' : (isHovered ? 'var(--nav-item-border-hover)' : 'var(--nav-item-border)'),
                    backgroundColor: selected ? 'var(--nav-item-bg-selected)' : (isHovered ? 'var(--nav-item-bg-hover)' : 'var(--nav-item-bg)'),
                    color: selected ? 'var(--nav-item-text-selected)' : 'inherit',
                    boxShadow: selected ? 'var(--nav-item-shadow-selected)' : (isHovered ? 'var(--nav-item-shadow-hover)' : 'var(--nav-item-shadow)'),
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
                      display: isNavCollapsed ? 'none' : undefined,
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
                        fontWeight: selected ? 700 : 500,
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
                
                <Collapse in={isExpanded} timeout="auto" unmountOnExit overflowVisible>
                  {item.subItems && (
                    <List disablePadding style={{ marginTop: NAV_SUB_VERTICAL_GAP * 8, display: 'flex', flexDirection: 'column', gap: `${NAV_SUB_VERTICAL_GAP * 8}px` }}>
                      {item.subItems.map((subItem) => {
                        const subSelected = isNavPathActive(location.pathname, subItem.to);
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
                              width: `calc(100% - ${sp(NAV_SUB_TEXT_INDENT)} - 2px)`,
                              marginLeft: sp(NAV_SUB_TEXT_INDENT),
                              marginRight: 0,
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

      {!isNavCollapsed && !isCompactStorage && <Divider style={{ marginTop: footerShouldScroll ? 12 : 8, marginBottom: 8, flexShrink: 0 }} />}

      {!isCompactStorage && (
        <div
          style={{
            paddingLeft: collapsed ? 8 : 16,
            paddingRight: collapsed ? 8 : 16,
            paddingBottom: 4,
            textAlign: 'left',
            marginTop: footerShouldScroll ? 0 : 'auto',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: isNavCollapsed ? 'center' : 'flex-start', gap: 4 }}>
            <Tooltip title="Click to view changelog" arrow placement="top">
              <Typography
                variant="caption"
                color="text.secondary"
                onClick={() => navigate('/changelog')}
                style={{
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: isNavCollapsed ? 'visible' : 'hidden',
                  textOverflow: isNavCollapsed ? 'clip' : 'ellipsis',
                  textAlign: isNavCollapsed ? 'center' : 'left',
                  fontSize: isNavCollapsed ? 'clamp(0.55rem, 1.6vw, 0.75rem)' : NAV_SECONDARY_FONT_SIZE,
                  letterSpacing: isNavCollapsed ? '-0.01em' : 'normal',
                  cursor: 'pointer',
                  textDecoration: 'none',
                }}
                title={versionLabel}
              >
                {displayVersionLabel}
              </Typography>
            </Tooltip>
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
            <Tooltip title="Click to view changelog" arrow placement="top">
              <Typography
                variant="caption"
                color="text.secondary"
                onClick={() => navigate('/changelog')}
                style={{ fontWeight: 600, cursor: 'pointer' }}
              >
                {versionLabel || 'Youtarr'}
              </Typography>
            </Tooltip>
          </div>
          {!((isMobile && sidebarBehavior.hideStorageFooterOnMobile)) && (
            <StorageFooterWidget
              token={token}
              collapsed={collapsed}
              compact
              inline
              justify="flex-end"
            />
          )}
        </div>
      ) : (
        !(isMobile && sidebarBehavior.hideStorageFooterOnMobile) && <StorageFooterWidget token={token} collapsed={collapsed} />
      )}

      <div style={{ height: 8, flexShrink: 0 }} />
    </div>
  );

  // --- MOBILE SPECIFIC RENDERING ---

  // 1. Mobile Bottom Navigation
  if (isMobile) {
    const activeIndex = navItems.findIndex((item) => item === activeItem);
    const subNavBottom = `calc(${MOBILE_NAV_PRIMARY_HEIGHT}px + env(safe-area-inset-bottom))`;

    return (
      <>
        {activeItemWithSubItems && (
          <div
            style={{
              position: 'fixed',
              bottom: subNavBottom,
              left: 0,
              right: 0,
              zIndex: 1299,
              backgroundColor: 'var(--mobile-subnav-surface-background)',
              borderTop: 'var(--mobile-subnav-surface-border-top)',
              borderRadius: 'var(--mobile-subnav-surface-radius)',
              padding: '8px 10px',
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              marginBottom: 'var(--mobile-subnav-surface-margin-bottom)',
              paddingBottom: 'var(--mobile-subnav-surface-padding-bottom)',
            }}
          >
            {(activeItemWithSubItems.subItems ?? []).map((subItem) => {
              const subSelected = isNavPathActive(location.pathname, subItem.to);
              return (
                <button
                  key={subItem.key}
                  onClick={() => navigate(subItem.to)}
                  style={{
                    background: subSelected ? 'var(--nav-item-bg-selected)' : 'var(--nav-item-bg)',
                    border: subSelected
                      ? 'var(--mobile-subnav-item-border-selected)'
                      : 'var(--mobile-subnav-item-border)',
                    borderRadius: 'var(--mobile-subnav-item-radius)',
                    color: subSelected ? 'var(--nav-item-text-selected)' : 'inherit',
                    boxShadow: subSelected ? 'var(--nav-item-shadow-selected)' : 'none',
                    cursor: 'pointer',
                    fontSize: NAV_SUB_FONT_SIZE,
                    fontWeight: subSelected ? 700 : 500,
                    padding: '6px 14px',
                    whiteSpace: 'nowrap',
                    transition: 'all 200ms var(--transition-bouncy)',
                    textTransform: 'var(--mobile-subnav-item-text-transform)' as React.CSSProperties['textTransform'],
                    letterSpacing: 'var(--mobile-subnav-item-letter-spacing)',
                  }}
                >
                  {subItem.label}
                </button>
              );
            })}
          </div>
        )}
        <Paper
          elevation={3}
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1300,
            paddingBottom: 'env(safe-area-inset-bottom)',
            borderRadius: 'var(--mobile-primary-nav-surface-radius)',
            borderTop: 'var(--mobile-primary-nav-surface-border-top)',
            backgroundColor: 'var(--mobile-primary-nav-surface-background)',
            overflow: 'visible',
            boxShadow: 'var(--mobile-primary-nav-surface-shadow)',
          }}
        >
          <nav style={{ display: 'flex', height: MOBILE_NAV_PRIMARY_HEIGHT, backgroundColor: 'transparent' }}>
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
                    gap: 4,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: isActive
                      ? 'var(--mobile-primary-nav-active-color)'
                      : 'var(--muted-foreground)',
                    padding: '6px 0',
                    transition: 'color 0.2s, background-color 0.2s',
                    position: 'relative',
                    backgroundColor: isActive
                      ? 'var(--mobile-primary-nav-active-background)'
                      : 'transparent',
                  }}
                >
                  {React.cloneElement(item.icon as React.ReactElement, {
                    size: isActive ? 24 : 20,
                    style: { transition: 'all 0.2s' },
                  })}
                  <span
                    style={{
                      fontSize: 'var(--mobile-primary-nav-label-font-size)',
                      lineHeight: 1,
                      textTransform: 'var(--mobile-primary-nav-label-text-transform)' as React.CSSProperties['textTransform'],
                      letterSpacing: 'var(--mobile-primary-nav-label-letter-spacing)',
                      fontWeight: isActive ? 700 : 500,
                    }}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </Paper>
      </>
    );
  }

  // 2. Desktop or Industrial Mobile Drawer
  const drawerBorderRadius = isMobile
    ? sidebarBehavior.mobileDrawerBorderRadius
    : NAV_DRAWER_BORDER_RADIUS;

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    borderRadius: drawerBorderRadius,
    border: 'var(--nav-border)',
    boxShadow: 'var(--nav-shadow)',
    backgroundColor: 'var(--card)',
    marginTop: isMobile ? sidebarBehavior.mobileDrawerMarginTop : NAV_DRAWER_DESKTOP_TOP_OFFSET,
    marginBottom: isMobile ? sidebarBehavior.mobileDrawerMarginBottom : 'var(--shell-gap)',
    marginLeft: isMobile ? 0 : 'var(--shell-gap)',
    marginRight: isMobile ? 0 : 'var(--shell-gap)',
    paddingLeft: isMobile ? 0 : drawerPanelPaddingLeft,
    paddingRight: isMobile ? 0 : drawerPanelPaddingRight,
    maxHeight: isMobile ? sidebarBehavior.mobileDrawerMaxHeight : NAV_DRAWER_DESKTOP_MAX_HEIGHT,
    overflow: 'hidden',
    overflowX: 'visible',
    width: isMobile ? sidebarBehavior.mobileDrawerWidth : drawerWidth,
    boxSizing: 'border-box',
    transition: 'width 300ms var(--transition-bouncy), padding 300ms var(--transition-bouncy)',
    top: isMobile ? sidebarBehavior.mobileDrawerTop : 0,
    left: isMobile ? sidebarBehavior.mobileDrawerLeft : undefined,
    right: isMobile ? sidebarBehavior.mobileDrawerRight : undefined,
    bottom: isMobile ? sidebarBehavior.mobileDrawerBottom : 'var(--shell-gap)',
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
              backgroundColor: 'var(--overlay-backdrop-background)',
            }}
            onClick={onCloseMobile}
          />
        )}
        {drawerOpenMobile && (
          <div className="app-nav-paper" style={panelStyle}>
            {drawerContent}
          </div>
        )}
      </>
    );
  }

  // Desktop permanent drawer
  return (
    <div className="app-nav-paper" style={panelStyle}>
      {drawerContent}
    </div>
  );
};
