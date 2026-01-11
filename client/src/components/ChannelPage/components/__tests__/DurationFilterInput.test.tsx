import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DurationFilterInput from '../DurationFilterInput';
import { renderWithProviders } from '../../../../test-utils';

describe('DurationFilterInput Component', () => {
  const defaultProps = {
    minDuration: null,
    maxDuration: null,
    onMinChange: jest.fn(),
    onMaxChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Non-Compact Mode (default)', () => {
    test('renders Duration label and both inputs', () => {
      renderWithProviders(<DurationFilterInput {...defaultProps} />);

      expect(screen.getByText('Duration:')).toBeInTheDocument();
      expect(screen.getByText('to')).toBeInTheDocument();
      expect(screen.getByText('min')).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { name: /minimum duration/i })).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { name: /maximum duration/i })).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    test('hides Duration label in compact mode', () => {
      renderWithProviders(<DurationFilterInput {...defaultProps} compact={true} />);

      expect(screen.queryByText('Duration:')).not.toBeInTheDocument();
      expect(screen.getByText('to')).toBeInTheDocument();
      expect(screen.getByText('min')).toBeInTheDocument();
    });
  });

  describe('Value Display', () => {
    test('displays provided duration values', () => {
      renderWithProviders(
        <DurationFilterInput {...defaultProps} minDuration={5} maxDuration={30} />
      );

      const minInput = screen.getByRole('spinbutton', { name: /minimum duration/i });
      const maxInput = screen.getByRole('spinbutton', { name: /maximum duration/i });

      expect(minInput).toHaveValue(5);
      expect(maxInput).toHaveValue(30);
    });

    test('displays empty inputs when values are null', () => {
      renderWithProviders(<DurationFilterInput {...defaultProps} />);

      const minInput = screen.getByRole('spinbutton', { name: /minimum duration/i });
      const maxInput = screen.getByRole('spinbutton', { name: /maximum duration/i });

      expect(minInput).toHaveValue(null);
      expect(maxInput).toHaveValue(null);
    });
  });

  describe('User Interactions', () => {
    test('calls onMinChange with number when valid value is entered', async () => {
      const user = userEvent.setup();
      const onMinChange = jest.fn();

      renderWithProviders(
        <DurationFilterInput {...defaultProps} onMinChange={onMinChange} />
      );

      const minInput = screen.getByRole('spinbutton', { name: /minimum duration/i });
      await user.type(minInput, '5');

      expect(onMinChange).toHaveBeenCalledWith(5);
    });

    test('calls onMaxChange with number when valid value is entered', async () => {
      const user = userEvent.setup();
      const onMaxChange = jest.fn();

      renderWithProviders(
        <DurationFilterInput {...defaultProps} onMaxChange={onMaxChange} />
      );

      const maxInput = screen.getByRole('spinbutton', { name: /maximum duration/i });
      await user.type(maxInput, '9');

      expect(onMaxChange).toHaveBeenCalledWith(9);
    });

    test('calls onMinChange with null when input is cleared', async () => {
      const user = userEvent.setup();
      const onMinChange = jest.fn();

      renderWithProviders(
        <DurationFilterInput {...defaultProps} minDuration={10} onMinChange={onMinChange} />
      );

      const minInput = screen.getByRole('spinbutton', { name: /minimum duration/i });
      await user.clear(minInput);

      expect(onMinChange).toHaveBeenCalledWith(null);
    });

    test('calls onMaxChange with null when input is cleared', async () => {
      const user = userEvent.setup();
      const onMaxChange = jest.fn();

      renderWithProviders(
        <DurationFilterInput {...defaultProps} maxDuration={30} onMaxChange={onMaxChange} />
      );

      const maxInput = screen.getByRole('spinbutton', { name: /maximum duration/i });
      await user.clear(maxInput);

      expect(onMaxChange).toHaveBeenCalledWith(null);
    });

    test('accepts zero as a valid value', async () => {
      const user = userEvent.setup();
      const onMinChange = jest.fn();

      renderWithProviders(
        <DurationFilterInput {...defaultProps} onMinChange={onMinChange} />
      );

      const minInput = screen.getByRole('spinbutton', { name: /minimum duration/i });
      await user.type(minInput, '0');

      expect(onMinChange).toHaveBeenCalledWith(0);
    });
  });
});
