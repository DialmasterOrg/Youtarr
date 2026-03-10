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
  NavHeader: ({ toggleDrawer, isCollapsed, themeMode }: { toggleDrawer: () => void; isCollapsed: boolean; themeMode: string }) => (
    themeMode === 'playful' ? (
      <button onClick={toggleDrawer} type="button">
        toggle:{themeMode}:{String(isCollapsed)}
      </button>
    ) : null
  ),
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

    await user.click(screen.getByRole('button', { name: /toggle:playful:false/i }));

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

  it('toggles the mobile drawer state without assigning desktop nav width', async () => {
    const user = userEvent.setup();
    renderShell('playful', true);

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--nav-width')).toBe('0px');
    });

    await user.click(screen.getByRole('button', { name: /toggle:playful:true/i }));

    expect(screen.getByTestId('nav-sidebar')).toHaveTextContent('collapsed:false|topnav:false|mobileopen:true');
  });
});