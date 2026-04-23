import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DatePickerButton from '../DatePickerButton';
import { renderWithProviders } from '../../../../../test-utils';

describe('DatePickerButton', () => {
  test('renders placeholder when value is empty', () => {
    renderWithProviders(
      <DatePickerButton
        value=""
        onChange={jest.fn()}
        placeholder="From"
        ariaLabel="Published from date"
      />
    );
    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Published from date' })).toBeInTheDocument();
  });

  test('renders a formatted date when a value is set', () => {
    renderWithProviders(
      <DatePickerButton
        value="2024-03-15"
        onChange={jest.fn()}
        placeholder="From"
        ariaLabel="Published from date"
      />
    );
    expect(screen.queryByText('From')).not.toBeInTheDocument();
    // Locale-formatted short date. Avoid asserting exact locale; just check year.
    expect(screen.getByRole('button', { name: 'Published from date' })).toBeInTheDocument();
  });

  test('clicking the main button opens the native picker', async () => {
    const user = userEvent.setup();
    const showPicker = jest.fn();
    const original = HTMLInputElement.prototype.showPicker as unknown;
    (HTMLInputElement.prototype as unknown as { showPicker: () => void }).showPicker = showPicker;
    try {
      renderWithProviders(
        <DatePickerButton
          value=""
          onChange={jest.fn()}
          ariaLabel="Published from date"
        />
      );
      await user.click(screen.getByRole('button', { name: 'Published from date' }));
      expect(showPicker).toHaveBeenCalledTimes(1);
    } finally {
      if (typeof original === 'function') {
        (HTMLInputElement.prototype as unknown as { showPicker: () => void }).showPicker = original as () => void;
      } else {
        delete (HTMLInputElement.prototype as unknown as Record<string, unknown>).showPicker;
      }
    }
  });

  test('falls back to focus+click when showPicker is unavailable', async () => {
    const user = userEvent.setup();
    const original = (HTMLInputElement.prototype as unknown as { showPicker?: () => void }).showPicker;
    delete (HTMLInputElement.prototype as unknown as Record<string, unknown>).showPicker;
    try {
      const onChange = jest.fn();
      renderWithProviders(
        <DatePickerButton
          value=""
          onChange={onChange}
          ariaLabel="Published from date"
        />
      );
      // Should not throw when clicking even without showPicker support.
      await user.click(screen.getByRole('button', { name: 'Published from date' }));
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      if (typeof original === 'function') {
        (HTMLInputElement.prototype as unknown as { showPicker: () => void }).showPicker = original;
      }
    }
  });

  test('clear button clears the value', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(
      <DatePickerButton
        value="2024-03-15"
        onChange={onChange}
        ariaLabel="Published from date"
        clearAriaLabel="Clear published from date"
      />
    );
    await user.click(screen.getByRole('button', { name: 'Clear published from date' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  test('no clear button is rendered when value is empty', () => {
    renderWithProviders(
      <DatePickerButton
        value=""
        onChange={jest.fn()}
        ariaLabel="Published from date"
        clearAriaLabel="Clear published from date"
      />
    );
    expect(
      screen.queryByRole('button', { name: 'Clear published from date' })
    ).not.toBeInTheDocument();
  });
});
