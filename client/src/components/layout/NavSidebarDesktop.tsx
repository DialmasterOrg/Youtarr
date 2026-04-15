import React from 'react';
import type { Location } from 'react-router-dom';
import { NavDrawerContent } from './NavDrawerContent';
import { NavItem } from './navigation';
import type { ThemeSidebarBehavior } from '../../themes/types';

interface NavSidebarDesktopProps {
  panelStyle: React.CSSProperties;
  navItems: NavItem[];
  location: Location;
  sidebarBehavior: ThemeSidebarBehavior;
  showSectionIcons: boolean;
  isNavCollapsed: boolean;
  collapsed: boolean;
  footerShouldScroll: boolean;
  navButtonGapLeft: string;
  navButtonGapRight: string;
  token: string | null;
  versionLabel?: string;
}

export const NavSidebarDesktop: React.FC<NavSidebarDesktopProps> = ({
  panelStyle,
  navItems,
  location,
  sidebarBehavior,
  showSectionIcons,
  isNavCollapsed,
  collapsed,
  footerShouldScroll,
  navButtonGapLeft,
  navButtonGapRight,
  token,
  versionLabel,
}) => {
  return (
    <div className="app-nav-paper" style={panelStyle}>
      <NavDrawerContent
        navItems={navItems}
        location={location}
        sidebarBehavior={sidebarBehavior}
        showSectionIcons={showSectionIcons}
        isMobile={false}
        isNavCollapsed={isNavCollapsed}
        collapsed={collapsed}
        footerShouldScroll={footerShouldScroll}
        navButtonGapLeft={navButtonGapLeft}
        navButtonGapRight={navButtonGapRight}
        token={token}
        versionLabel={versionLabel}
      />
    </div>
  );
};
