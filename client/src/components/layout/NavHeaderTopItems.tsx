import React, { useState, useEffect } from 'react';
import { Box, Button, Paper } from '../ui';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useThemeEngine } from '../../contexts/ThemeEngineContext';
import { NavItem, isNavItemExpanded, isNavPathActive } from './navigation';

interface NavHeaderTopItemsProps {
  navItems: NavItem[];
  showLandscapeNavItems: boolean;
  menuPaperStyle: React.CSSProperties;
}

export const NavHeaderTopItems: React.FC<NavHeaderTopItemsProps> = ({
  navItems,
  showLandscapeNavItems,
  menuPaperStyle,
}) => {
  const location = useLocation();
  const { showSectionIcons } = useThemeEngine();

  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    setActiveKey(null);
  }, [location.pathname]);

  const handleUnitEnter = (_event: React.MouseEvent<HTMLElement>, key: string) => {
    setActiveKey(key);
  };

  const handleUnitLeave = () => {
    setActiveKey(null);
  };

  const getButtonStyle = (isParentActive: boolean): React.CSSProperties => {
    return {
      color: isParentActive ? 'var(--header-nav-active-color)' : 'var(--header-nav-default-color)',
      fontWeight: isParentActive ? 700 : 500,
      fontSize: '0.85rem',
      textTransform: 'none' as const,
      padding: '8px 12px',
      borderRadius: 'var(--radius-ui)',
      transition: 'all 0.15s ease-out',
      position: 'relative' as const,
    };
  };

  return (
    <Box
      className="flex items-center gap-2"
      style={{
        position: showLandscapeNavItems ? 'relative' : 'absolute',
        left: showLandscapeNavItems ? undefined : '50%',
        transform: showLandscapeNavItems ? undefined : 'translateX(-50%)',
        height: showLandscapeNavItems ? 'auto' : '100%',
        width: showLandscapeNavItems ? '100%' : undefined,
        flex: showLandscapeNavItems ? '0 0 auto' : undefined,
        flexWrap: showLandscapeNavItems ? 'wrap' : 'nowrap',
        minWidth: 0,
        overflow: 'visible',
        rowGap: showLandscapeNavItems ? 6 : 0,
        paddingBottom: showLandscapeNavItems ? 4 : 0,
      }}
    >
      {navItems.map((item) => {
        const isOpen = activeKey === item.key;
        const hasSubItems = item.subItems && item.subItems.length > 0;
        const isParentActive = isNavItemExpanded(location.pathname, item);

        return (
          <Box
            key={item.key}
            onMouseEnter={(event) => !showLandscapeNavItems && hasSubItems && handleUnitEnter(event, item.key)}
            onMouseLeave={() => {
              if (!showLandscapeNavItems) {
                handleUnitLeave();
              }
            }}
            style={{ position: 'relative', height: 'auto', display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            <Button
              asChild
              variant="text"
              style={{
                ...getButtonStyle(isParentActive),
                padding: showLandscapeNavItems ? '5px 10px' : '8px 12px',
                fontSize: showLandscapeNavItems ? '0.76rem' : '0.85rem',
                whiteSpace: 'nowrap',
              }}
            >
              <RouterLink to={item.to}>
                {showSectionIcons && !showLandscapeNavItems && (
                  <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center [&>svg]:h-[1.25em] [&>svg]:w-[1.25em]">
                    {item.icon}
                  </span>
                )}
                <span>{item.label}</span>
              </RouterLink>
            </Button>

            {hasSubItems && isOpen && !showLandscapeNavItems && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  zIndex: 1500,
                  paddingTop: 8,
                }}
              >
                <Paper style={menuPaperStyle}>
                  {(item.subItems ?? []).map((subItem) => {
                    const isSubActive = isNavPathActive(location.pathname, subItem.to);
                    return (
                      <RouterLink
                        key={subItem.key}
                        to={subItem.to}
                        onClick={handleUnitLeave}
                        style={{
                          display: 'block',
                          textDecoration: 'none',
                          width: '100%',
                          borderRadius: 'var(--layout-header-menu-radius)',
                          fontSize: '0.85rem',
                          fontWeight: 500,
                          color: isSubActive
                            ? 'var(--header-subnav-active-color)'
                            : 'var(--muted-foreground)',
                          padding: '8px 12px',
                          boxSizing: 'border-box',
                        }}
                      >
                        {subItem.label}
                      </RouterLink>
                    );
                  })}
                </Paper>
              </div>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
