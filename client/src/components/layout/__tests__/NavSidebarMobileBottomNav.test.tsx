import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Location } from 'react-router-dom';
import { NavSidebarMobileBottomNav } from '../NavSidebarMobileBottomNav';
import { NavItem } from '../navigation';

const SUBSCRIPTIONS_ITEM: NavItem = {
  key: 'subscriptions',
  label: 'Channels & Playlists',
  icon: <span>SubscriptionsIcon</span>,
  to: '/subscriptions',
  subItems: [
    { key: 'subscriptions-list', label: 'Channels & Playlists', to: '/subscriptions' },
    { key: 'subscriptions-find', label: 'Find Channels on YouTube', to: '/subscriptions/find' },
    { key: 'subscriptions-imports', label: 'Import Channels', to: '/subscriptions/imports' },
  ],
};

const VIDEOS_ITEM: NavItem = {
  key: 'videos',
  label: 'Videos',
  icon: <span>VideosIcon</span>,
  to: '/videos',
  subItems: [
    { key: 'videos-downloaded', label: 'Downloaded Videos', to: '/videos' },
    { key: 'videos-find', label: 'Find Videos on YouTube', to: '/videos/find' },
  ],
};

const NAV_ITEMS = [SUBSCRIPTIONS_ITEM, VIDEOS_ITEM];

function makeLocation(pathname: string): Location {
  return { pathname, search: '', hash: '', state: null, key: 'test' };
}

interface RenderOverrides {
  activeItem?: NavItem | null;
  activeItemWithSubItems?: NavItem | null;
  navigate?: jest.Mock;
}

function renderBottomNav(pathname: string, overrides: RenderOverrides = {}) {
  const navigate = overrides.navigate ?? jest.fn();
  const props = {
    navItems: NAV_ITEMS,
    location: makeLocation(pathname),
    navigate,
    activeItem: 'activeItem' in overrides ? overrides.activeItem ?? null : SUBSCRIPTIONS_ITEM,
    activeItemWithSubItems:
      'activeItemWithSubItems' in overrides
        ? overrides.activeItemWithSubItems ?? null
        : SUBSCRIPTIONS_ITEM,
  };
  const view = render(<NavSidebarMobileBottomNav {...props} />);
  return { ...view, navigate, props };
}

function setScrollMetrics(
  el: HTMLElement,
  { scrollWidth, clientWidth, scrollLeft }: { scrollWidth: number; clientWidth: number; scrollLeft: number }
) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth });
  el.scrollLeft = scrollLeft;
}

const scrollIntoViewMock = jest.fn();

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: scrollIntoViewMock,
  });
});

afterAll(() => {
  delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

beforeEach(() => {
  scrollIntoViewMock.mockClear();
});

describe('NavSidebarMobileBottomNav - subnav overflow affordance', () => {
  it('flags the right edge as scrollable when chips overflow at the start', () => {
    renderBottomNav('/subscriptions');
    const subnav = screen.getByTestId('mobile-subnav');

    setScrollMetrics(subnav, { scrollWidth: 600, clientWidth: 360, scrollLeft: 0 });
    fireEvent.scroll(subnav);

    expect(subnav).toHaveAttribute('data-can-scroll-right', 'true');
    expect(subnav).toHaveAttribute('data-can-scroll-left', 'false');
  });

  it('flags both edges when scrolled to the middle', () => {
    renderBottomNav('/subscriptions');
    const subnav = screen.getByTestId('mobile-subnav');

    setScrollMetrics(subnav, { scrollWidth: 600, clientWidth: 360, scrollLeft: 100 });
    fireEvent.scroll(subnav);

    expect(subnav).toHaveAttribute('data-can-scroll-left', 'true');
    expect(subnav).toHaveAttribute('data-can-scroll-right', 'true');
  });

  it('flags only the left edge when scrolled to the end', () => {
    renderBottomNav('/subscriptions');
    const subnav = screen.getByTestId('mobile-subnav');

    setScrollMetrics(subnav, { scrollWidth: 600, clientWidth: 360, scrollLeft: 240 });
    fireEvent.scroll(subnav);

    expect(subnav).toHaveAttribute('data-can-scroll-left', 'true');
    expect(subnav).toHaveAttribute('data-can-scroll-right', 'false');
  });

  it('flags neither edge when all chips fit', () => {
    renderBottomNav('/subscriptions');
    const subnav = screen.getByTestId('mobile-subnav');

    setScrollMetrics(subnav, { scrollWidth: 360, clientWidth: 360, scrollLeft: 0 });
    fireEvent.scroll(subnav);

    expect(subnav).toHaveAttribute('data-can-scroll-left', 'false');
    expect(subnav).toHaveAttribute('data-can-scroll-right', 'false');
  });
});

describe('NavSidebarMobileBottomNav - selected chip visibility', () => {
  it('scrolls the selected chip into view on mount', () => {
    renderBottomNav('/subscriptions/imports');

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ inline: 'nearest', block: 'nearest' });
  });

  it('scrolls the newly selected chip into view when the route changes', () => {
    const { rerender, props } = renderBottomNav('/subscriptions');
    scrollIntoViewMock.mockClear();

    rerender(
      <NavSidebarMobileBottomNav {...props} location={makeLocation('/subscriptions/imports')} />
    );

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ inline: 'nearest', block: 'nearest' });
  });

  it('does not scroll when no chip matches the current route', () => {
    renderBottomNav('/subscriptions/unknown-route');

    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });
});

describe('NavSidebarMobileBottomNav - basic behavior', () => {
  it('renders a chip for every sub-item of the active section', () => {
    renderBottomNav('/subscriptions');

    expect(screen.getByRole('button', { name: 'Find Channels on YouTube' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import Channels' })).toBeInTheDocument();
  });

  it('navigates to the sub-item route when a chip is tapped', () => {
    const { navigate } = renderBottomNav('/subscriptions');

    fireEvent.click(screen.getByRole('button', { name: 'Import Channels' }));

    expect(navigate).toHaveBeenCalledWith('/subscriptions/imports');
  });

  it('renders no subnav when the active section has no sub-items', () => {
    renderBottomNav('/subscriptions', { activeItemWithSubItems: null });

    expect(screen.queryByTestId('mobile-subnav')).not.toBeInTheDocument();
  });
});
