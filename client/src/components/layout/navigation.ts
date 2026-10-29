import type { ReactNode } from 'react';

export type AppNavKey = string;

export interface NavSubItem {
  key: string;
  label: string;
  to: string;
  /** Also active on paths under `to` (a page with its own sub-routes) */
  matchPrefix?: boolean;
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

export const isNavSubItemActive = (path: string, subItem: Pick<NavSubItem, 'to' | 'matchPrefix'>) => (
  path === subItem.to || (subItem.matchPrefix === true && path.startsWith(`${subItem.to}/`))
);

export const isNavItemExpanded = (path: string, item: NavItem) => {
  if (isNavItemSelected(path, item)) {
    return true;
  }

  return item.subItems?.some((subItem) => isNavSubItemActive(path, subItem)) || false;
};
