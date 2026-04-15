import React, { useEffect, useState } from 'react';
import type { Location } from 'react-router-dom';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Collapse,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from '../ui';
import { StorageFooterWidget } from './StorageFooterWidget';
import { NavItem, isNavItemExpanded, isNavPathActive } from './navigation';
import type { ThemeSidebarBehavior } from '../../themes/types';
import {
  NAV_MAIN_BUTTON_SIDE_PADDING,
  NAV_SUB_FONT_SIZE,
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
const NAV_SUB_LINE_HEIGHT = 1.2;

// Spacing helper: 1 unit = 8px
const sp = (n: number) => `${n * 8}px`;

interface NavDrawerContentProps {
  navItems: NavItem[];
  location: Location;
  sidebarBehavior: ThemeSidebarBehavior;
  showSectionIcons: boolean;
  isMobile: boolean;
  isNavCollapsed: boolean;
  collapsed: boolean;
  footerShouldScroll: boolean;
  navButtonGapLeft: string;
  navButtonGapRight: string;
  token: string | null;
  versionLabel?: string;
}

export const NavDrawerContent: React.FC<NavDrawerContentProps> = ({
  navItems,
  location,
  sidebarBehavior,
  showSectionIcons,
  isMobile,
  isNavCollapsed,
  collapsed,
  footerShouldScroll,
  navButtonGapLeft,
  navButtonGapRight,
  token,
  versionLabel,
}) => {
  const navigate = useNavigate();
  const isCompactStorage = false;
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

  return (
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
                  {showSectionIcons && (
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
                  )}
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
};
