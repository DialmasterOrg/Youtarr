import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DateRangeFilterInput from '../DateRangeFilterInput';
import { renderWithProviders } from '../../../../test-utils';

describe('DateRangeFilterInput Component', () => {
  const defaultProps = {
    dateFrom: null,
    dateTo: null,
    onFromChange: jest.fn(),
    onToChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Non-Compact Mode (default)', () => {
    test('renders Date label and both date inputs', () => {
      renderWithProviders(<DateRangeFilterInput {...defaultProps} />);

      expect(screen.getByText('Date:')).toBeInTheDocument();
      expect(screen.getByText('to')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /filter from date/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /filter to date/i })).toBeInTheDocument();
    });

    test('does not show From/To labels on date pickers', () => {
      renderWithProviders(<DateRangeFilterInput {...defaultProps} />);

      // In non-compact mode, the DatePicker labels should not be present
      expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('To')).not.toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    test('hides Date label in compact mode', () => {
      renderWithProviders(<DateRangeFilterInput {...defaultProps} compact={true} />);

      expect(screen.queryByText('Date:')).not.toBeInTheDocument();
      expect(screen.getByText('to')).toBeInTheDocument();
    });

    test('shows From/To labels on date pickers in compact mode', () => {
      renderWithProviders(<DateRangeFilterInput {...defaultProps} compact={true} />);

      expect(screen.getByLabelText('From')).toBeInTheDocument();
      expect(screen.getByLabelText('To')).toBeInTheDocument();
    });
  });

  describe('Value Display', () => {
    test('displays provided date values', () => {
      const fromDate = new Date(2024, 0, 15); // Jan 15, 2024
      const toDate = new Date(2024, 5, 20); // Jun 20, 2024

      renderWithProviders(
        <DateRangeFilterInput
          {...defaultProps}
          dateFrom={fromDate}
          dateTo={toDate}
        />
      );

      const fromInput = screen.getByRole('textbox', { name: /filter from date/i });
      const toInput = screen.getByRole('textbox', { name: /filter to date/i });

      expect(fromInput).toHaveValue('01/15/2024');
      expect(toInput).toHaveValue('06/20/2024');
    });

    test('displays empty inputs when dates are null', () => {
      renderWithProviders(<DateRangeFilterInput {...defaultProps} />);

      const fromInput = screen.getByRole('textbox', { name: /filter from date/i });
      const toInput = screen.getByRole('textbox', { name: /filter to date/i });

      expect(fromInput).toHaveValue('');
      expect(toInput).toHaveValue('');
    });
  });

  describe('User Interactions', () => {
    test('calls onFromChange when from date is typed', async () => {
      const user = userEvent.setup();
      const onFromChange = jest.fn();

      renderWithProviders(
        <DateRangeFilterInput {...defaultProps} onFromChange={onFromChange} />
      );

      const fromInput = screen.getByRole('textbox', { name: /filter from date/i });
      await user.clear(fromInput);
      await user.type(fromInput, '01/15/2024');

      expect(onFromChange).toHaveBeenCalled();
    });

    test('calls onToChange when to date is typed', async () => {
      const user = userEvent.setup();
      const onToChange = jest.fn();

      renderWithProviders(
        <DateRangeFilterInput {...defaultProps} onToChange={onToChange} />
      );

      const toInput = screen.getByRole('textbox', { name: /filter to date/i });
      await user.clear(toInput);
      await user.type(toInput, '06/20/2024');

      expect(onToChange).toHaveBeenCalled();
    });
  });
});
