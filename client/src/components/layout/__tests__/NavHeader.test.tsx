import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { NavHeader } from '../NavHeader';
import { ThemeEngineProvider } from '../../../contexts/ThemeEngineContext';
import { TooltipProvider } from '../../ui/tooltip';

jest.mock('../StorageHeaderWidget', () => ({
  StorageHeaderWidget: () => null,
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
  isMobile: false,
  themeMode: 'linear' as const,
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

describe('NavHeader shared update indicator', () => {
  beforeEach(() => {
    localStorage.clear();
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
    renderHeader({ themeMode: 'flat' });

    const titleLink = screen.getByRole('link', { name: 'Youtarr' });
    expect(titleLink).toHaveStyle({ marginLeft: '12px' });
  });

  it('uses the shared indicator for a yt-dlp-only update on the playful theme', () => {
    localStorage.setItem('uiThemeMode', 'playful');

    renderHeader({
      themeMode: 'playful',
      updateAvailable: false,
      ytDlpUpdateAvailable: true,
      ytDlpUpdateTooltip: 'yt-dlp update available (2025.10.01). Go to Settings to update.',
    });

    expect(screen.getByRole('button', { name: /yt-dlp update available/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new version available/i })).not.toBeInTheDocument();
  });
});