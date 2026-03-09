import React from 'react';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { render } from '@testing-library/react';
import { NavSidebar } from '../NavSidebar';
import { ThemeEngineProvider } from '../../../contexts/ThemeEngineContext';
import { TooltipProvider } from '../../ui/tooltip';

// Suppress storage widget — it makes real API calls
jest.mock('../StorageFooterWidget', () => ({
  StorageFooterWidget: () => null,
}));

const CHANNELS_ITEM = {
  key: 'channels',
  label: 'Channels',
  oldLabel: 'Your Channels',
  icon: <span>ChannelsIcon</span>,
  to: '/channels',
};

const DOWNLOADS_ITEM = {
  key: 'downloads',
  label: 'Downloads',
  oldLabel: 'Manage Downloads',
  icon: <span>DownloadsIcon</span>,
  to: '/downloads',
  subItems: [
    { key: 'download-manual', label: 'Manual Download', to: '/downloads/manual' },
    { key: 'download-activity', label: 'Activity', to: '/downloads/activity' },
    { key: 'download-history', label: 'History', to: '/downloads/history' },
  ],
};

const SETTINGS_ITEM = {
  key: 'settings',
  label: 'Settings',
  oldLabel: 'Configuration',
  icon: <span>SettingsIcon</span>,
  to: '/settings',
  subItems: [
    { key: 'core', label: 'Core', to: '/settings/core' },
    { key: 'appearance', label: 'Appearance', to: '/settings/appearance' },
  ],
};

const NAV_ITEMS = [CHANNELS_ITEM, DOWNLOADS_ITEM, SETTINGS_ITEM];

const DEFAULT_SIDEBAR_PROPS = {
  isMobile: false,
  isTopNav: false,
  drawerOpenMobile: false,
  collapsed: false,
  navItems: NAV_ITEMS,
  token: null,
  onCloseMobile: jest.fn(),
};

/** Button that triggers client-side navigation to a given route */
function NavigationTrigger({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button data-testid={`go-to-${to.replace(/\//g, '-')}`} onClick={() => navigate(to)}>
      Go to {to}
    </button>
  );
}

function renderSidebar(initialRoute: string, props = {}) {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <ThemeEngineProvider>
        <TooltipProvider>
          <NavigationTrigger to="/channels" />
          <NavigationTrigger to="/settings/core" />
          <NavigationTrigger to="/settings/appearance" />
          <NavigationTrigger to="/downloads/activity" />
          <NavSidebar {...DEFAULT_SIDEBAR_PROPS} {...props} />
        </TooltipProvider>
      </ThemeEngineProvider>
    </MemoryRouter>
  );
}

// ─────────────────────────────────────────────────────────────────
// SECTION: Sub-item visibility based on current route
// ─────────────────────────────────────────────────────────────────

describe('NavSidebar – sub-item visibility', () => {
  it('shows settings sub-items when at the settings root page', () => {
    renderSidebar('/settings');

    expect(screen.getByText('Core')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  it('shows settings sub-items when at a settings sub-page (/settings/core)', () => {
    renderSidebar('/settings/core');

    expect(screen.getByText('Core')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  it('shows settings sub-items when at a different settings sub-page (/settings/appearance)', () => {
    renderSidebar('/settings/appearance');

    expect(screen.getByText('Core')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  it('shows downloads sub-items when at a downloads sub-page (/downloads/activity)', () => {
    renderSidebar('/downloads/activity');

    expect(screen.getByText('Manual Download')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
  });

  it('does not show settings sub-items when at an unrelated route (/channels)', () => {
    renderSidebar('/channels');

    expect(screen.queryByText('Core')).not.toBeInTheDocument();
    expect(screen.queryByText('Appearance')).not.toBeInTheDocument();
  });

  it('does not show downloads sub-items when at an unrelated route (/channels)', () => {
    renderSidebar('/channels');

    expect(screen.queryByText('Manual Download')).not.toBeInTheDocument();
    expect(screen.queryByText('Activity')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// SECTION: Sub-items re-appear after navigating away and back
// This covers a regression where sub-items were hidden after the
// Collapse component unmounted and then re-mounted (unmountOnExit bug).
// ─────────────────────────────────────────────────────────────────

describe('NavSidebar – sub-items re-appear after navigation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('shows settings sub-items again after navigating away to /channels and back', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderSidebar('/settings/core');

    // Sub-items are visible initially
    expect(screen.getByText('Core')).toBeInTheDocument();

    // Navigate away to /channels — wait for Collapse animation to unmount
    await user.click(screen.getByTestId('go-to--channels'));
    act(() => { jest.runAllTimers(); });
    expect(screen.queryByText('Core')).not.toBeInTheDocument();

    // Navigate back to a settings sub-page — sub-items MUST reappear (regression guard)
    await user.click(screen.getByTestId('go-to--settings-core'));
    act(() => { jest.runAllTimers(); });
    expect(screen.getByText('Core')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  it('shows downloads sub-items again after navigating away and back', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderSidebar('/downloads/activity');

    expect(screen.getByText('Activity')).toBeInTheDocument();

    await user.click(screen.getByTestId('go-to--channels'));
    act(() => { jest.runAllTimers(); });
    expect(screen.queryByText('Activity')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('go-to--downloads-activity'));
    act(() => { jest.runAllTimers(); });
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('Manual Download')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
  });

  it('correctly switches expanded section when navigating between sections', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderSidebar('/settings/core');

    // Settings open
    expect(screen.getByText('Core')).toBeInTheDocument();
    expect(screen.queryByText('Activity')).not.toBeInTheDocument();

    // Navigate to downloads — wait for settings section to collapse/unmount
    await user.click(screen.getByTestId('go-to--downloads-activity'));
    act(() => { jest.runAllTimers(); });
    expect(screen.queryByText('Core')).not.toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();

    // Navigate back to settings — downloads section collapses, settings expands
    await user.click(screen.getByTestId('go-to--settings-appearance'));
    act(() => { jest.runAllTimers(); });
    expect(screen.getByText('Core')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.queryByText('Activity')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// SECTION: Collapsed sidebar hides sub-items (by design)
// ─────────────────────────────────────────────────────────────────

describe('NavSidebar – collapsed state', () => {
  it('hides sub-items when sidebar is collapsed', () => {
    renderSidebar('/settings/core', { collapsed: true });

    // Sub-items should not be visible when sidebar is fully collapsed
    expect(screen.queryByText('Core')).not.toBeInTheDocument();
    expect(screen.queryByText('Appearance')).not.toBeInTheDocument();
  });

  it('does not render a yt-dlp update badge in the sidebar footer', () => {
    renderSidebar('/channels', {
      versionLabel: 'v1.59.0 • yt-dlp: 2025.09.23',
      ytDlpUpdateAvailable: true,
      ytDlpUpdateTooltip: 'yt-dlp update available (2025.10.01). Go to Settings to update.',
    });

    expect(screen.queryByLabelText(/yt-dlp update available/i)).not.toBeInTheDocument();
  });
});
