import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import IgnoredFilter from '../IgnoredFilter';
import { renderWithProviders } from '../../../../../test-utils';

describe('IgnoredFilter', () => {
  test('renders inactive label when value is false', () => {
    renderWithProviders(<IgnoredFilter value={false} onChange={jest.fn()} />);
    expect(screen.getByText('Ignored')).toBeInTheDocument();
    expect(screen.queryByText('Ignored Only')).not.toBeInTheDocument();
  });

  test('renders active label when value is true', () => {
    renderWithProviders(<IgnoredFilter value={true} onChange={jest.fn()} />);
    expect(screen.getByText('Ignored Only')).toBeInTheDocument();
  });

  test('clicking the chip toggles the value on', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(<IgnoredFilter value={false} onChange={onChange} />);
    await user.click(screen.getByText('Ignored'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('clicking the chip toggles the value off', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(<IgnoredFilter value={true} onChange={onChange} />);
    await user.click(screen.getByText('Ignored Only'));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
