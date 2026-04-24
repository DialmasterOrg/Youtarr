import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import VideoListFilterPanel from '../VideoListFilterPanel';
import { ChipFilterMode, FilterConfig } from '../types';
import { renderWithProviders } from '../../../../test-utils';

function statusFilters(overrides: Partial<{
  protectedValue: ChipFilterMode;
  missingValue: ChipFilterMode;
  ignoredValue: ChipFilterMode;
  onProtected: jest.Mock;
  onMissing: jest.Mock;
  onIgnored: jest.Mock;
}> = {}): FilterConfig[] {
  return [
    { id: 'protected', value: overrides.protectedValue ?? 'off', onChange: overrides.onProtected ?? jest.fn() },
    { id: 'missing', value: overrides.missingValue ?? 'off', onChange: overrides.onMissing ?? jest.fn() },
    { id: 'ignored', value: overrides.ignoredValue ?? 'off', onChange: overrides.onIgnored ?? jest.fn() },
  ];
}

describe('VideoListFilterPanel - inline variant', () => {
  test('renders nothing when closed', () => {
    renderWithProviders(
      <VideoListFilterPanel filters={statusFilters()} variant="inline" open={false} />
    );
    expect(screen.queryByTestId('video-list-filter-panel-inline')).not.toBeInTheDocument();
  });

  test('renders the inline panel with filter controls when open', () => {
    renderWithProviders(
      <VideoListFilterPanel
        filters={[{ id: 'maxRating', value: '', onChange: jest.fn() }]}
        variant="inline"
        open
      />
    );
    expect(screen.getByTestId('video-list-filter-panel-inline')).toBeInTheDocument();
  });

  test('does not show Clear All when no filters are active', () => {
    renderWithProviders(
      <VideoListFilterPanel filters={statusFilters()} variant="inline" open />
    );
    expect(screen.queryByTestId('video-list-clear-filters')).not.toBeInTheDocument();
  });

  test('shows Clear All when at least one filter is active and clears them on click', async () => {
    const user = userEvent.setup();
    const onProtected = jest.fn();
    const onMissing = jest.fn();
    renderWithProviders(
      <VideoListFilterPanel
        filters={statusFilters({
          protectedValue: 'only',
          missingValue: 'exclude',
          onProtected,
          onMissing,
        })}
        variant="inline"
        open
      />
    );
    const clearAll = screen.getByTestId('video-list-clear-filters');
    await user.click(clearAll);
    expect(onProtected).toHaveBeenCalledWith('off');
    expect(onMissing).toHaveBeenCalledWith('off');
  });

  test('renders customFilters node alongside filter controls', () => {
    renderWithProviders(
      <VideoListFilterPanel
        filters={statusFilters()}
        variant="inline"
        open
        customFilters={<span data-testid="custom-filter">Custom</span>}
      />
    );
    expect(screen.getByTestId('custom-filter')).toBeInTheDocument();
  });

  test('renders a consistent label above each labelled filter in the inline panel', () => {
    const filters: FilterConfig[] = [
      {
        id: 'duration',
        min: null,
        max: null,
        inputMin: null,
        inputMax: null,
        onMinChange: jest.fn(),
        onMaxChange: jest.fn(),
      },
      {
        id: 'dateRangeString',
        dateFrom: '',
        dateTo: '',
        onFromChange: jest.fn(),
        onToChange: jest.fn(),
      },
      { id: 'maxRating', value: '', onChange: jest.fn() },
    ];
    renderWithProviders(
      <VideoListFilterPanel filters={filters} variant="inline" open />
    );
    const panel = screen.getByTestId('video-list-filter-panel-inline');
    expect(within(panel).getByText('Duration (min)')).toBeInTheDocument();
    expect(within(panel).getByText('Published')).toBeInTheDocument();
    expect(within(panel).getByText('Max Rating')).toBeInTheDocument();
  });

  test('groups all status chips (including downloaded) into a single inline flex container', () => {
    const filters: FilterConfig[] = [
      ...statusFilters(),
      { id: 'downloaded', value: 'off', onChange: jest.fn() },
    ];
    renderWithProviders(
      <VideoListFilterPanel filters={filters} variant="inline" open />
    );
    const group = screen.getByTestId('video-list-filter-status-group-inline');
    for (const name of ['Protected', 'Missing', 'Ignored', 'Downloaded']) {
      expect(
        within(group).getByRole('button', { name: new RegExp(`^${name}$`, 'i') })
      ).toBeInTheDocument();
    }
  });
});

describe('VideoListFilterPanel - drawer variant', () => {
  test('renders nothing when closed', () => {
    renderWithProviders(
      <VideoListFilterPanel
        filters={statusFilters()}
        variant="drawer"
        open={false}
        onClose={jest.fn()}
      />
    );
    expect(screen.queryByTestId('video-list-filter-drawer')).not.toBeInTheDocument();
  });

  test('renders a portal dialog with a Filters title when open', () => {
    renderWithProviders(
      <VideoListFilterPanel
        filters={statusFilters()}
        variant="drawer"
        open
        onClose={jest.fn()}
      />
    );
    const dialog = screen.getByRole('dialog', { name: /filters/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  test('groups protected/missing/ignored filters under a single Status heading', () => {
    renderWithProviders(
      <VideoListFilterPanel
        filters={statusFilters()}
        variant="drawer"
        open
        onClose={jest.fn()}
      />
    );
    expect(screen.getAllByText('Status')).toHaveLength(1);
  });

  test('groups the downloaded filter under the same Status heading as other status chips', () => {
    const filters: FilterConfig[] = [
      ...statusFilters(),
      { id: 'downloaded', value: 'off', onChange: jest.fn() },
    ];
    renderWithProviders(
      <VideoListFilterPanel filters={filters} variant="drawer" open onClose={jest.fn()} />
    );
    expect(screen.getAllByText('Status')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^Downloaded$/i })).toBeInTheDocument();
  });

  test('cycles the downloaded chip through off → only → exclude when clicked in the panel', async () => {
    const user = userEvent.setup();
    const onDownloaded = jest.fn();
    const filters: FilterConfig[] = [
      { id: 'downloaded', value: 'off', onChange: onDownloaded },
    ];
    renderWithProviders(
      <VideoListFilterPanel filters={filters} variant="inline" open />
    );
    await user.click(screen.getByRole('button', { name: /^Downloaded$/i }));
    expect(onDownloaded).toHaveBeenCalledWith('only');
  });

  test('close button calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    renderWithProviders(
      <VideoListFilterPanel
        filters={statusFilters()}
        variant="drawer"
        open
        onClose={onClose}
      />
    );
    await user.click(screen.getByTestId('video-list-filter-drawer-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Escape key calls onClose', () => {
    const onClose = jest.fn();
    renderWithProviders(
      <VideoListFilterPanel
        filters={statusFilters()}
        variant="drawer"
        open
        onClose={onClose}
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Close footer button calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    renderWithProviders(
      <VideoListFilterPanel
        filters={statusFilters()}
        variant="drawer"
        open
        onClose={onClose}
      />
    );
    await user.click(screen.getByRole('button', { name: /^close$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  test('Clear All footer button is disabled when no filters are active', () => {
    renderWithProviders(
      <VideoListFilterPanel
        filters={statusFilters()}
        variant="drawer"
        open
        onClose={jest.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /clear all/i })).toBeDisabled();
  });

  test('Clear All footer button clears active filters', async () => {
    const user = userEvent.setup();
    const onProtected = jest.fn();
    renderWithProviders(
      <VideoListFilterPanel
        filters={statusFilters({ protectedValue: 'only', onProtected })}
        variant="drawer"
        open
        onClose={jest.fn()}
      />
    );
    const clearAll = screen.getByRole('button', { name: /clear all/i });
    expect(clearAll).not.toBeDisabled();
    await user.click(clearAll);
    expect(onProtected).toHaveBeenCalledWith('off');
  });

  test('renders explanatory text when a date-range filter is hidden with a reason', () => {
    const filters: FilterConfig[] = [
      {
        id: 'dateRange',
        dateFrom: null,
        dateTo: null,
        onFromChange: jest.fn(),
        onToChange: jest.fn(),
        hidden: true,
        hiddenReason: 'Date filter unavailable for this view',
      },
    ];
    renderWithProviders(
      <VideoListFilterPanel filters={filters} variant="drawer" open onClose={jest.fn()} />
    );
    expect(screen.getByText(/date filter unavailable for this view/i)).toBeInTheDocument();
  });
});
