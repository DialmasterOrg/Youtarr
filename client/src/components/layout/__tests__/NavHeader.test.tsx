import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { NavHeader } from '../NavHeader';
import { ThemeEngineProvider } from '../../../contexts/ThemeEngineContext';
import { TooltipProvider } from '../../ui/tooltip';
import { getThemeById, resolveThemeLayoutPolicy } from '../../../themes';

jest.mock('../StorageHeaderWidget', () => ({
  StorageHeaderWidget: () => <div data-testid="storage-header-widget" />,
}));

const NAV_ITEMS = [
  {
    key: 'channels',
    label: 'Channels',
    icon: <span>ChannelsIcon</span>,
    to: '/channels',
  },
];

type NavHeaderProps = React.ComponentProps<typeof NavHeader>;

const BASE_PROPS: NavHeaderProps = {
  appName: 'Youtarr',
  layoutPolicy: resolveThemeLayoutPolicy(getThemeById('linear'), 'desktop'),
  navItems: NAV_ITEMS,
  token: 'test-token',
  isPlatformManaged: false,
  versionLabel: 'v1.59.0 • yt-dlp: 2025.09.23',
  updateAvailable: false,
  updateTooltip: undefined,
  ytDlpUpdateAvailable: false,
  ytDlpUpdateTooltip: undefined,
  onLogout: jest.fn(),
  toggleDrawer: jest.fn(),
  APP_BAR_TOGGLE_SIZE: 44,
  isCollapsed: false,
};

function renderHeader(overrides: Partial<NavHeaderProps> = {}) {
  return render(
    <MemoryRouter initialEntries={['/channels']}>
      <ThemeEngineProvider>
        <TooltipProvider>
          <NavHeader {...BASE_PROPS} {...overrides} />
        </TooltipProvider>
      </ThemeEngineProvider>
    </MemoryRouter>
  );
}

function setMatchMedia({ isLandscape = false }: { isLandscape?: boolean } = {}) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query === '(orientation: landscape)' ? isLandscape : false,
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

describe('NavHeader shared update indicator', () => {
  beforeEach(() => {
    localStorage.clear();
    setMatchMedia();
  });

  it('renders a single shared update indicator when both Youtarr and yt-dlp need updates', async () => {
    const user = userEvent.setup();

    renderHeader({
      updateAvailable: true,
      updateTooltip: 'New version (v1.60.0) available! Please shut down and pull the latest image and files to update.',
      ytDlpUpdateAvailable: true,
      ytDlpUpdateTooltip: 'yt-dlp update available (2025.10.01). Go to Settings to update.',
    });

    const sharedIndicator = screen.getByRole('button', { name: /youtarr and yt-dlp updates available/i });
    expect(sharedIndicator).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /yt-dlp update available/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new version available/i })).not.toBeInTheDocument();

    await user.hover(sharedIndicator);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(/Youtarr: New version \(v1.60.0\) available!/i);
    expect(tooltip).toHaveTextContent(/yt-dlp: yt-dlp update available \(2025.10.01\)\./i);
  });

  it('adds left spacing before the title in top-nav themes', () => {
    renderHeader({ layoutPolicy: resolveThemeLayoutPolicy(getThemeById('flat'), 'desktop') });

    const header = screen.getByRole('banner') as HTMLElement;
    const titleLink = screen.getByRole('link', { name: /youtarr logo youtarr/i });
    expect(header.style.getPropertyValue('--layout-header-title-inset')).toBe('12px');
    expect(titleLink).toHaveStyle({ marginLeft: 'var(--layout-header-title-inset)' });
  });

  it('renders section icons in top-nav theme buttons when enabled', () => {
    renderHeader({ layoutPolicy: resolveThemeLayoutPolicy(getThemeById('flat'), 'desktop') });

    const channelsLink = screen.getByRole('link', { name: 'Channels' });
    expect(within(channelsLink).getByText('ChannelsIcon')).toBeInTheDocument();
  });

  it('hides section icons in top-nav theme buttons when disabled', () => {
    localStorage.setItem('uiSectionIconsVisible:linear', 'false');

    renderHeader();

    const channelsLink = screen.getByRole('link', { name: 'Channels' });
    expect(within(channelsLink).queryByText('ChannelsIcon')).not.toBeInTheDocument();
  });

  it('uses the shared indicator for a yt-dlp-only update on the playful theme', () => {
    localStorage.setItem('uiThemeMode', 'playful');

    renderHeader({
      layoutPolicy: resolveThemeLayoutPolicy(getThemeById('playful'), 'desktop'),
      updateAvailable: false,
      ytDlpUpdateAvailable: true,
      ytDlpUpdateTooltip: 'yt-dlp update available (2025.10.01). Go to Settings to update.',
    });

    expect(screen.getByRole('button', { name: /yt-dlp update available/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new version available/i })).not.toBeInTheDocument();
  });

  it('keeps the playful header fully framed instead of removing the top border', () => {
    localStorage.setItem('uiThemeMode', 'playful');

    renderHeader({ layoutPolicy: resolveThemeLayoutPolicy(getThemeById('playful'), 'mobile') });

    const header = screen.getByRole('banner') as HTMLElement;

    expect(header.dataset.headerFrameMode).toBe('inset');
    expect(header.style.getPropertyValue('--layout-header-border')).toBe('var(--appbar-border)');
    expect(header.style.boxShadow).toBe('none');
    expect(header.style.borderTop).toBe('');
    expect(header.style.borderLeft).toBe('');
    expect(header.style.borderRight).toBe('');
  });

  it('shows direct section navigation in mobile landscape without rendering a menu toggle', () => {
    setMatchMedia({ isLandscape: true });

    renderHeader({ layoutPolicy: resolveThemeLayoutPolicy(getThemeById('playful'), 'mobile') });

    expect(screen.getByRole('link', { name: 'Channels' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/toggle navigation/i)).not.toBeInTheDocument();
  });

  it('renders the storage widget in the playful mobile header', () => {
    localStorage.setItem('uiThemeMode', 'playful');

    renderHeader({ layoutPolicy: resolveThemeLayoutPolicy(getThemeById('playful'), 'mobile') });

    expect(screen.getByTestId('storage-header-widget')).toBeInTheDocument();
  });

  it('renders the header wordmark 30 percent larger across themes', () => {
    renderHeader({ layoutPolicy: resolveThemeLayoutPolicy(getThemeById('flat'), 'desktop') });

    const wordmark = screen.getByRole('img', { name: 'Youtarr' });

    expect(wordmark).toHaveStyle({
      height: '40px',
      maxWidth: 'min(234px, 58.5vw)',
    });
  });

  it('aligns header left/right padding with content window on mobile playful theme', () => {
    renderHeader({ layoutPolicy: resolveThemeLayoutPolicy(getThemeById('playful'), 'mobile') });

    const headerInner = screen.getByTestId('nav-header-inner');

    // On mobile playful, header should use 4px padding to match contentPadding: '8px 4px'
    const computedStyle = window.getComputedStyle(headerInner);
    expect(computedStyle.paddingLeft).toBe('4px');
    expect(computedStyle.paddingRight).toBe('4px');
  });
});