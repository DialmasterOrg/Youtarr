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

export const isChannelsSectionActive = (path: string, basePath: string, key: AppNavKey) => {
  if (path === basePath || path.startsWith(`${basePath}/`)) {
    return true;
  }

  return key === 'channels' && path.startsWith('/channel/');
};

export const isNavPathActive = (path: string, targetPath: string) => {
  return path === targetPath || path.startsWith(`${targetPath}/`);
};

export const isNavItemActive = (path: string, item: NavItem) => {
  return isChannelsSectionActive(path, item.to, item.key)
    || item.subItems?.some((subItem) => isNavPathActive(path, subItem.to))
    || false;
};
