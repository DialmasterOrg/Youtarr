import React from 'react';
import type { Location, NavigateFunction } from 'react-router-dom';
import { Paper } from '../ui';
import { NavItem, isNavPathActive } from './navigation';
import { MOBILE_NAV_PRIMARY_HEIGHT, NAV_SUB_FONT_SIZE } from './navLayoutConstants';

interface NavSidebarMobileBottomNavProps {
  navItems: NavItem[];
  location: Location;
  navigate: NavigateFunction;
  activeItem: NavItem | null;
  activeItemWithSubItems: NavItem | null;
}

// The mobile nav in practice is a fixed bottom primary bar plus an optional
// fixed subnav above it for the active section's sub-items. (The pre-split
// NavSidebar.tsx had a "temporary drawer" branch below a similar block, but
// that branch was unreachable and has been dropped during decomposition.)
export const NavSidebarMobileBottomNav: React.FC<NavSidebarMobileBottomNavProps> = ({
  navItems,
  location,
  navigate,
  activeItem,
  activeItemWithSubItems,
}) => {
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
};
