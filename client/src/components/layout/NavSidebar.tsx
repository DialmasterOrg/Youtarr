import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getThemeById } from '../../themes';
import { useThemeEngine } from '../../contexts/ThemeEngineContext';
import { NavItem, isNavItemExpanded } from './navigation';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { NavSidebarDesktop } from './NavSidebarDesktop';
import { NavSidebarMobileBottomNav } from './NavSidebarMobileBottomNav';
import {
  HEADER_HEIGHT_DESKTOP,
  MOBILE_NAV_PRIMARY_HEIGHT,
  MOBILE_NAV_SECONDARY_HEIGHT,
  NAV_DRAWER_PANEL_PADDING_X,
  NAV_DRAWER_PANEL_PADDING_X_COLLAPSED,
  NAV_SIDEBAR_COLLAPSED_WIDTH,
  NAV_SIDEBAR_EXPANDED_WIDTH,
} from './navLayoutConstants';

const NAV_DRAWER_BORDER_RADIUS = 'var(--nav-radius)';
const NAV_DRAWER_DESKTOP_TOP_OFFSET = `calc(${HEADER_HEIGHT_DESKTOP}px + var(--shell-gap))`;
const NAV_DRAWER_DESKTOP_MAX_HEIGHT = `calc(100vh - (${HEADER_HEIGHT_DESKTOP}px + var(--shell-gap)) - (var(--shell-gap) * 2))`;

interface NavSidebarProps {
  isMobile: boolean;
  isTopNav: boolean;
  collapsed: boolean;
  navItems: NavItem[];
  versionLabel?: string;
  token: string | null;
}

export const NavSidebar: React.FC<NavSidebarProps> = ({
  isMobile,
  isTopNav,
  collapsed,
  navItems,
  versionLabel,
  token,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { themeMode, showSectionIcons } = useThemeEngine();
  const sidebarBehavior = getThemeById(themeMode).sidebarBehavior;
  const isCompactHeight = useMediaQuery('(max-height: 500px)');
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

  if (isMobile) {
    return (
      <NavSidebarMobileBottomNav
        navItems={navItems}
        location={location}
        navigate={navigate}
        activeItem={activeItem}
        activeItemWithSubItems={activeItemWithSubItems}
      />
    );
  }

  return (
    <NavSidebarDesktop
      panelStyle={panelStyle}
      navItems={navItems}
      location={location}
      sidebarBehavior={sidebarBehavior}
      showSectionIcons={showSectionIcons}
      isNavCollapsed={isNavCollapsed}
      collapsed={collapsed}
      footerShouldScroll={footerShouldScroll}
      navButtonGapLeft={navButtonGapLeft}
      navButtonGapRight={navButtonGapRight}
      token={token}
      versionLabel={versionLabel}
    />
  );
};
