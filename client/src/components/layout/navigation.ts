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
  if (item.to === '/channels') {
    return path === item.to || (item.key === 'channels' && path.startsWith('/channel/'));
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

  return key === 'channels' && path.startsWith('/channel/');
};

export const isNavPathActive = (path: string, targetPath: string) => {
  return path === targetPath;
};

export const isNavItemActive = (path: string, item: NavItem) => {
  return isNavItemExpanded(path, item);
};
