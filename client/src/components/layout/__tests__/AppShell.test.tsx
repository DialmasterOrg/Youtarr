import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { ThemeEngineProvider } from '../../../contexts/ThemeEngineContext';
import { AppShell } from '../AppShell';

jest.mock('../BackgroundDecorations', () => ({
  BackgroundDecorations: () => null,
}));

jest.mock('../NavHeader', () => ({
  NavHeader: ({ toggleDrawer, isCollapsed, layoutPolicy }: { toggleDrawer: () => void; isCollapsed: boolean; layoutPolicy: { breakpoint: string; navPlacement: string; showHeaderToggleOnMobile: boolean } }) => {
    const showToggle = layoutPolicy.breakpoint === 'mobile'
      ? layoutPolicy.showHeaderToggleOnMobile
      : layoutPolicy.navPlacement === 'sidebar';

    return showToggle ? (
      <button onClick={toggleDrawer} type="button">
        toggle:{layoutPolicy.navPlacement}:{layoutPolicy.breakpoint}:{String(isCollapsed)}
      </button>
    ) : null;
  },
}));

jest.mock('../NavSidebar', () => ({
  NavSidebar: ({ collapsed, isTopNav, drawerOpenMobile }: { collapsed: boolean; isTopNav: boolean; drawerOpenMobile: boolean }) => (
    <div data-testid="nav-sidebar">
      collapsed:{String(collapsed)}|topnav:{String(isTopNav)}|mobileopen:{String(drawerOpenMobile)}
    </div>
  ),
}));

function setViewportMatch(isMobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query === '(max-width: 767px)' ? isMobile : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

function renderShell(themeMode: 'playful' | 'linear' | 'flat', isMobile = false) {
  setViewportMatch(isMobile);
  localStorage.setItem('uiThemeMode', themeMode);

  return render(
    <MemoryRouter initialEntries={['/channels']}>
      <ThemeEngineProvider>
        <AppShell token="test-token" isPlatformManaged={false}>
          <div>Shell content</div>
        </AppShell>
      </ThemeEngineProvider>
    </MemoryRouter>
  );
}

function getLayoutRoot() {
  return document.querySelector('[data-layout-contract-root]') as HTMLElement;
}

function getContentFrame() {
  return screen.getByTestId('app-shell-content-frame');
}

describe('AppShell', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('updates nav width when desktop sidebar is collapsed', async () => {
    const user = userEvent.setup();
    renderShell('playful');

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--nav-width')).toBe('200px');
    });

    await user.click(screen.getByRole('button', { name: /toggle:sidebar:desktop:false/i }));

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--nav-width')).toBe('65px');
    });

    expect(screen.getByTestId('nav-sidebar')).toHaveTextContent('collapsed:true|topnav:false|mobileopen:false');
    expect(screen.getByText('Shell content')).toBeInTheDocument();
  });

  it('uses top-nav layout width rules for flat theme', async () => {
    renderShell('flat');

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--nav-width')).toBe('0px');
    });

    expect(screen.getByTestId('nav-sidebar')).toHaveTextContent('collapsed:false|topnav:true|mobileopen:false');
    expect(screen.queryByRole('button', { name: /toggle:flat:true/i })).not.toBeInTheDocument();
  });

  it('renders the top header on mobile and allows opening mobile drawer state', async () => {
    const user = userEvent.setup();
    renderShell('playful', true);

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--nav-width')).toBe('0px');
    });

    await user.click(screen.getByRole('button', { name: /toggle:sidebar:mobile:true/i }));

    expect(screen.getByTestId('nav-sidebar')).toHaveTextContent('collapsed:false|topnav:false|mobileopen:true');
  });

  it('uses tighter mobile frame padding for playful theme content', () => {
    renderShell('playful', true);

    expect(getLayoutRoot().style.getPropertyValue('--layout-content-padding')).toBe('12px 6px');
    expect(getContentFrame()).toHaveAttribute('data-layout-breakpoint', 'mobile');
  });

  it('uses tighter mobile outer and inner padding for top-nav themes', () => {
    const { container } = renderShell('flat', true);

    expect(container.querySelector('main')).toHaveAttribute('data-nav-placement', 'top');
    expect(getLayoutRoot().style.getPropertyValue('--layout-main-padding')).toBe('8px 8px calc(20px + env(safe-area-inset-bottom))');
    expect(getLayoutRoot().style.getPropertyValue('--layout-content-padding')).toBe('12px 8px');
  });
});