import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MobileFilterDrawer from '../MobileFilterDrawer';
import { renderWithProviders } from '../../../../test-utils';
import { VideoFilters } from '../../hooks/useChannelVideoFilters';

// Mock the child filter components
jest.mock('../DurationFilterInput', () => ({
  __esModule: true,
  default: function MockDurationFilterInput(props: {
    minDuration: number | null;
    maxDuration: number | null;
    onMinChange: (v: number | null) => void;
    onMaxChange: (v: number | null) => void;
  }) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'duration-filter' }, [
      React.createElement('span', { key: 'min' }, `min:${props.minDuration}`),
      React.createElement('span', { key: 'max' }, `max:${props.maxDuration}`),
    ]);
  },
}));

jest.mock('../DateRangeFilterInput', () => ({
  __esModule: true,
  default: function MockDateRangeFilterInput(props: {
    dateFrom: Date | null;
    dateTo: Date | null;
  }) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'date-filter' }, [
      React.createElement('span', { key: 'from' }, `from:${props.dateFrom?.toISOString() ?? 'null'}`),
      React.createElement('span', { key: 'to' }, `to:${props.dateTo?.toISOString() ?? 'null'}`),
    ]);
  },
}));

describe('MobileFilterDrawer Component', () => {
  const defaultFilters: VideoFilters = {
    minDuration: null,
    maxDuration: null,
    dateFrom: null,
    dateTo: null,
  };

  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    filters: defaultFilters,
    inputMinDuration: null,
    inputMaxDuration: null,
    onMinDurationChange: jest.fn(),
    onMaxDurationChange: jest.fn(),
    onDateFromChange: jest.fn(),
    onDateToChange: jest.fn(),
    onClearAll: jest.fn(),
    hasActiveFilters: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders header with Filters title when open', () => {
      renderWithProviders(<MobileFilterDrawer {...defaultProps} />);

      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    test('renders Duration section with filter input', () => {
      renderWithProviders(<MobileFilterDrawer {...defaultProps} />);

      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByTestId('duration-filter')).toBeInTheDocument();
    });

    test('renders Date Range section with filter input when hideDateFilter is false', () => {
      renderWithProviders(<MobileFilterDrawer {...defaultProps} />);

      expect(screen.getByText('Date Range')).toBeInTheDocument();
      expect(screen.getByTestId('date-filter')).toBeInTheDocument();
    });

    test('renders Clear All and Close action buttons', () => {
      renderWithProviders(<MobileFilterDrawer {...defaultProps} />);

      expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^close$/i })).toBeInTheDocument();
    });
  });

  describe('hideDateFilter prop', () => {
    test('shows shorts message instead of date filter when hideDateFilter is true', () => {
      renderWithProviders(<MobileFilterDrawer {...defaultProps} hideDateFilter={true} />);

      expect(screen.queryByText('Date Range')).not.toBeInTheDocument();
      expect(screen.queryByTestId('date-filter')).not.toBeInTheDocument();
      expect(screen.getByText('Shorts do not have date information')).toBeInTheDocument();
    });
  });

  describe('Clear All Button', () => {
    test('Clear All button is disabled when hasActiveFilters is false', () => {
      renderWithProviders(<MobileFilterDrawer {...defaultProps} hasActiveFilters={false} />);

      expect(screen.getByRole('button', { name: /clear all/i })).toBeDisabled();
    });

    test('Clear All button is enabled when hasActiveFilters is true', () => {
      renderWithProviders(<MobileFilterDrawer {...defaultProps} hasActiveFilters={true} />);

      expect(screen.getByRole('button', { name: /clear all/i })).toBeEnabled();
    });

    test('calls onClearAll when Clear All button is clicked', async () => {
      const user = userEvent.setup();
      const onClearAll = jest.fn();

      renderWithProviders(
        <MobileFilterDrawer {...defaultProps} hasActiveFilters={true} onClearAll={onClearAll} />
      );

      await user.click(screen.getByRole('button', { name: /clear all/i }));

      expect(onClearAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('Close Functionality', () => {
    test('calls onClose when header close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();

      renderWithProviders(<MobileFilterDrawer {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByTestId('drawer-close-button'));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('calls onClose when action Close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();

      renderWithProviders(<MobileFilterDrawer {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: /^close$/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Filter Values Passed to Children', () => {
    test('passes duration values to DurationFilterInput', () => {
      renderWithProviders(
        <MobileFilterDrawer
          {...defaultProps}
          inputMinDuration={5}
          inputMaxDuration={30}
        />
      );

      const durationFilter = screen.getByTestId('duration-filter');
      expect(durationFilter).toHaveTextContent('min:5');
      expect(durationFilter).toHaveTextContent('max:30');
    });

    test('passes date values to DateRangeFilterInput', () => {
      const dateFrom = new Date('2024-01-15T00:00:00.000Z');
      const dateTo = new Date('2024-06-20T00:00:00.000Z');

      renderWithProviders(
        <MobileFilterDrawer
          {...defaultProps}
          filters={{ ...defaultFilters, dateFrom, dateTo }}
        />
      );

      const dateFilter = screen.getByTestId('date-filter');
      expect(dateFilter).toHaveTextContent('from:2024-01-15');
      expect(dateFilter).toHaveTextContent('to:2024-06-20');
    });
  });
});
