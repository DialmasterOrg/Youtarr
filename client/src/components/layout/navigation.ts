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

export const isChannelsSectionActive = (path: string, basePath: string, key: AppNavKey) => {
  if (path === basePath || path.startsWith(`${basePath}/`)) {
    return true;
  }

  return (
    key === 'subscriptions' &&
    (path.startsWith('/channel/') || path.startsWith('/playlist/'))
  );
};

export const isNavPathActive = (path: string, targetPath: string) => {
  return path === targetPath;
};

export const isNavItemActive = (path: string, item: NavItem) => {
  return isNavItemExpanded(path, item);
};
