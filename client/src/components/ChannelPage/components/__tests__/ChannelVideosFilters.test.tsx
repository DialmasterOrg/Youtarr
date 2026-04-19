import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChannelVideosFilters from '../ChannelVideosFilters';
import { VideoFilters } from '../../hooks/useChannelVideoFilters';
import { renderWithProviders } from '../../../../test-utils';

// Mock child components to isolate ChannelVideosFilters behavior
jest.mock('../DurationFilterInput', () => ({
  __esModule: true,
  default: function MockDurationFilterInput() {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'duration-filter-input' }, 'DurationFilterInput');
  },
}));

jest.mock('../DateRangeFilterInput', () => ({
  __esModule: true,
  default: function MockDateRangeFilterInput() {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'date-range-filter-input' }, 'DateRangeFilterInput');
  },
}));

jest.mock('../FilterChips', () => ({
  __esModule: true,
  default: function MockFilterChips(props: { onClearDuration: () => void; onClearDateRange: () => void }) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'filter-chips' },
      React.createElement('button', { 'data-testid': 'clear-duration-chip', onClick: props.onClearDuration }, 'Clear Duration'),
      React.createElement('button', { 'data-testid': 'clear-date-chip', onClick: props.onClearDateRange }, 'Clear Date')
    );
  },
}));

jest.mock('../MobileFilterDrawer', () => ({
  __esModule: true,
  default: function MockMobileFilterDrawer(props: { open: boolean; onClose: () => void; onClearAll: () => void; hasActiveFilters: boolean }) {
    const React = require('react');
    if (!props.open) return null;
    return React.createElement('div', { 'data-testid': 'mobile-filter-drawer' },
      React.createElement('button', { 'data-testid': 'drawer-close', onClick: props.onClose }, 'Close'),
      React.createElement('button', {
        'data-testid': 'drawer-clear-all',
        onClick: props.onClearAll,
        disabled: !props.hasActiveFilters
      }, 'Clear All')
    );
  },
}));

const defaultFilters: VideoFilters = {
  minDuration: null,
  maxDuration: null,
  dateFrom: null,
  dateTo: null,
};

describe('ChannelVideosFilters Component', () => {
  const defaultProps = {
    isMobile: false,
    filters: defaultFilters,
    inputMinDuration: null,
    inputMaxDuration: null,
    onMinDurationChange: jest.fn(),
    onMaxDurationChange: jest.fn(),
    onDateFromChange: jest.fn(),
    onDateToChange: jest.fn(),
    onClearAll: jest.fn(),
    hasActiveFilters: false,
    activeFilterCount: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Desktop Mode', () => {
    test('renders collapsed by default', () => {
      renderWithProviders(<ChannelVideosFilters {...defaultProps} />);

      // Component renders but filter inputs should not be visible due to collapsed state
      expect(screen.queryByTestId('duration-filter-input')).not.toBeVisible();
    });

    test('renders filter inputs when expanded', () => {
      renderWithProviders(<ChannelVideosFilters {...defaultProps} filtersExpanded={true} />);

      expect(screen.getByTestId('duration-filter-input')).toBeInTheDocument();
      expect(screen.getByTestId('date-range-filter-input')).toBeInTheDocument();
    });

    test('hides date filter when hideDateFilter is true', () => {
      renderWithProviders(
        <ChannelVideosFilters {...defaultProps} filtersExpanded={true} hideDateFilter={true} />
      );

      expect(screen.getByTestId('duration-filter-input')).toBeInTheDocument();
      expect(screen.queryByTestId('date-range-filter-input')).not.toBeInTheDocument();
      expect(screen.getByText('Shorts do not have date information')).toBeInTheDocument();
    });

    test('shows Clear All button when filters are active', () => {
      renderWithProviders(
        <ChannelVideosFilters {...defaultProps} filtersExpanded={true} hasActiveFilters={true} />
      );

      expect(screen.getByRole('button', { name: /Clear All/i })).toBeInTheDocument();
    });

    test('hides Clear All button when no filters active', () => {
      renderWithProviders(
        <ChannelVideosFilters {...defaultProps} filtersExpanded={true} hasActiveFilters={false} />
      );

      expect(screen.queryByRole('button', { name: /Clear All/i })).not.toBeInTheDocument();
    });

    test('calls onClearAll when Clear All button is clicked', async () => {
      const user = userEvent.setup();
      const onClearAll = jest.fn();

      renderWithProviders(
        <ChannelVideosFilters
          {...defaultProps}
          filtersExpanded={true}
          hasActiveFilters={true}
          onClearAll={onClearAll}
        />
      );

      await user.click(screen.getByRole('button', { name: /Clear All/i }));
      expect(onClearAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mobile Mode', () => {
    test('renders the mobile filter container on mobile', () => {
      renderWithProviders(<ChannelVideosFilters {...defaultProps} isMobile={true} />);

      expect(screen.queryByTestId('mobile-filter-drawer')).not.toBeInTheDocument();
    });

    test('renders drawer when mobileDrawerOpen is true', () => {
      renderWithProviders(<ChannelVideosFilters {...defaultProps} isMobile={true} mobileDrawerOpen={true} />);

      expect(screen.getByTestId('mobile-filter-drawer')).toBeInTheDocument();
    });

    test('closes drawer when close button is clicked', async () => {
      const user = userEvent.setup();
      const onMobileDrawerClose = jest.fn();

      renderWithProviders(
        <ChannelVideosFilters
          {...defaultProps}
          isMobile={true}
          mobileDrawerOpen={true}
          onMobileDrawerClose={onMobileDrawerClose}
        />
      );

      expect(screen.getByTestId('mobile-filter-drawer')).toBeInTheDocument();

      await user.click(screen.getByTestId('drawer-close'));
      expect(onMobileDrawerClose).toHaveBeenCalledTimes(1);
    });

    test('shows filter chips on mobile when filters are active', () => {
      renderWithProviders(
        <ChannelVideosFilters {...defaultProps} isMobile={true} hasActiveFilters={true} />
      );

      expect(screen.getByTestId('filter-chips')).toBeInTheDocument();
    });

    test('hides filter chips on mobile when no filters active', () => {
      renderWithProviders(
        <ChannelVideosFilters {...defaultProps} isMobile={true} hasActiveFilters={false} />
      );

      expect(screen.queryByTestId('filter-chips')).not.toBeInTheDocument();
    });

    test('does not render a local badge for active filter count', () => {
      renderWithProviders(
        <ChannelVideosFilters {...defaultProps} isMobile={true} activeFilterCount={2} />
      );

      expect(screen.queryByText('2')).not.toBeInTheDocument();
    });

    test('does not render a local badge when no active filters are present', () => {
      renderWithProviders(
        <ChannelVideosFilters {...defaultProps} isMobile={true} activeFilterCount={0} />
      );

      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });

  describe('Filter Clearing via Chips', () => {
    test('clears duration filter when chip is deleted', async () => {
      const user = userEvent.setup();
      const onMinDurationChange = jest.fn();
      const onMaxDurationChange = jest.fn();

      renderWithProviders(
        <ChannelVideosFilters
          {...defaultProps}
          isMobile={true}
          hasActiveFilters={true}
          onMinDurationChange={onMinDurationChange}
          onMaxDurationChange={onMaxDurationChange}
        />
      );

      await user.click(screen.getByTestId('clear-duration-chip'));

      expect(onMinDurationChange).toHaveBeenCalledWith(null);
      expect(onMaxDurationChange).toHaveBeenCalledWith(null);
    });

    test('clears date range filter when chip is deleted', async () => {
      const user = userEvent.setup();
      const onDateFromChange = jest.fn();
      const onDateToChange = jest.fn();

      renderWithProviders(
        <ChannelVideosFilters
          {...defaultProps}
          isMobile={true}
          hasActiveFilters={true}
          onDateFromChange={onDateFromChange}
          onDateToChange={onDateToChange}
        />
      );

      await user.click(screen.getByTestId('clear-date-chip'));

      expect(onDateFromChange).toHaveBeenCalledWith(null);
      expect(onDateToChange).toHaveBeenCalledWith(null);
    });
  });
});
