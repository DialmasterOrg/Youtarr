import type { ReactNode } from 'react';

export type AppNavKey = string;

export interface NavSubItem {
  key: string;
  label: string;
  to: string;
}

export interface NavItem {
  key: AppNavKey;
  label: string;
  oldLabel?: string;
  icon: ReactNode;
  to: string;
  subItems?: NavSubItem[];
}

export const isNavItemSelected = (path: string, item: NavItem) => {
  if (item.to === '/subscriptions') {
    return (
      path === item.to ||
      (item.key === 'subscriptions' &&
        (path.startsWith('/channel/') || path.startsWith('/playlist/')))
    );
  }

  return path === item.to || path.startsWith(`${item.to}/`);
};

export const isNavItemExpanded = (path: string, item: NavItem) => {
  if (isNavItemSelected(path, item)) {
    return true;
  }

  return item.subItems?.some((subItem) => isNavPathActive(path, subItem.to)) || false;
};

export const isNavPathActive = (path: string, targetPath: string) => {
  return path === targetPath;
};
