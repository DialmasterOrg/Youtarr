import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import FilterChips from '../FilterChips';
import { VideoFilters } from '../../hooks/useChannelVideoFilters';
import { renderWithProviders } from '../../../../test-utils';

const defaultFilters: VideoFilters = {
  minDuration: null,
  maxDuration: null,
  dateFrom: null,
  dateTo: null,
};

// Create dates using explicit year/month/day to avoid timezone issues
function createDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

describe('FilterChips Component', () => {
  const defaultProps = {
    filters: defaultFilters,
    onClearDuration: jest.fn(),
    onClearDateRange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('returns null when no filters are active', () => {
      renderWithProviders(<FilterChips {...defaultProps} />);

      // With no active filters, the component should not render any chips
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    test('renders duration chip when minDuration is set', () => {
      renderWithProviders(
        <FilterChips
          {...defaultProps}
          filters={{ ...defaultFilters, minDuration: 5 }}
        />
      );

      expect(screen.getByText('5+ min')).toBeInTheDocument();
    });

    test('renders duration chip when maxDuration is set', () => {
      renderWithProviders(
        <FilterChips
          {...defaultProps}
          filters={{ ...defaultFilters, maxDuration: 10 }}
        />
      );

      expect(screen.getByText('0-10 min')).toBeInTheDocument();
    });

    test('renders duration chip when both min and max duration are set', () => {
      renderWithProviders(
        <FilterChips
          {...defaultProps}
          filters={{ ...defaultFilters, minDuration: 5, maxDuration: 20 }}
        />
      );

      expect(screen.getByText('5-20 min')).toBeInTheDocument();
    });

    test('renders date chip when dateFrom is set', () => {
      const dateFrom = createDate(2024, 6, 15);
      renderWithProviders(
        <FilterChips
          {...defaultProps}
          filters={{ ...defaultFilters, dateFrom }}
        />
      );

      expect(screen.getByText(/From Jun 15/)).toBeInTheDocument();
    });

    test('renders date chip when dateTo is set', () => {
      const dateTo = createDate(2024, 6, 20);
      renderWithProviders(
        <FilterChips
          {...defaultProps}
          filters={{ ...defaultFilters, dateTo }}
        />
      );

      expect(screen.getByText(/Until Jun 20/)).toBeInTheDocument();
    });

    test('renders date chip with range when both dates are set', () => {
      const dateFrom = createDate(2024, 6, 15);
      const dateTo = createDate(2024, 6, 20);
      renderWithProviders(
        <FilterChips
          {...defaultProps}
          filters={{ ...defaultFilters, dateFrom, dateTo }}
        />
      );

      expect(screen.getByText(/Jun 15 - Jun 20/)).toBeInTheDocument();
    });

    test('renders both chips when duration and date filters are active', () => {
      const dateFrom = createDate(2024, 6, 15);
      renderWithProviders(
        <FilterChips
          {...defaultProps}
          filters={{ ...defaultFilters, minDuration: 5, dateFrom }}
        />
      );

      expect(screen.getByText('5+ min')).toBeInTheDocument();
      expect(screen.getByText(/From Jun 15/)).toBeInTheDocument();
    });
  });

  describe('Chip Deletion', () => {
    test('calls onClearDuration when duration chip delete icon is clicked', async () => {
      const user = userEvent.setup();
      const onClearDuration = jest.fn();

      renderWithProviders(
        <FilterChips
          {...defaultProps}
          filters={{ ...defaultFilters, minDuration: 5 }}
          onClearDuration={onClearDuration}
        />
      );

      // Find the chip by its text, then find the delete icon within it
      const chip = screen.getByRole('button', { name: /5\+ min/i });
      const deleteIcon = within(chip).getByTestId('CancelIcon');
      await user.click(deleteIcon);

      expect(onClearDuration).toHaveBeenCalledTimes(1);
    });

    test('calls onClearDateRange when date chip delete icon is clicked', async () => {
      const user = userEvent.setup();
      const onClearDateRange = jest.fn();
      const dateFrom = createDate(2024, 6, 15);

      renderWithProviders(
        <FilterChips
          {...defaultProps}
          filters={{ ...defaultFilters, dateFrom }}
          onClearDateRange={onClearDateRange}
        />
      );

      const chip = screen.getByRole('button', { name: /From Jun 15/i });
      const deleteIcon = within(chip).getByTestId('CancelIcon');
      await user.click(deleteIcon);

      expect(onClearDateRange).toHaveBeenCalledTimes(1);
    });
  });
});
