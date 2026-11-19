import type { ReactNode } from 'react';

export type AppNavKey = string;

export interface NavSubItem {
  key: string;
  label: string;
  to: string;
  /** Also active on paths under `to` (a page with its own sub-routes) */
  matchPrefix?: boolean;
  /** Heading the item is listed under. Items of one group must be adjacent. */
  group?: string;
}

export interface NavItem {
  key: AppNavKey;
  label: string;
  oldLabel?: string;
  icon: ReactNode;
  to: string;
  subItems?: NavSubItem[];
  /** No sub-item strip above the phone's bottom bar: the section's own page lists its sub-pages */
  hideSubItemsOnMobile?: boolean;
}

export interface NavSubItemSection {
  /** null for sub-items without a group */
  group: string | null;
  items: NavSubItem[];
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

/** Splits sub-items into runs that share a group, in their given order. */
export const groupNavSubItems = (subItems: NavSubItem[]): NavSubItemSection[] => {
  const sections: NavSubItemSection[] = [];
  subItems.forEach((subItem) => {
    const group = subItem.group ?? null;
    const last = sections[sections.length - 1];
    if (last && last.group === group) {
      last.items.push(subItem);
      return;
    }
    sections.push({ group, items: [subItem] });
  });
  return sections;
};
