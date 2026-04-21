import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MissingFilter from '../MissingFilter';
import { renderWithProviders } from '../../../../../test-utils';

describe('MissingFilter', () => {
  test('renders inactive label when value is false', () => {
    renderWithProviders(<MissingFilter value={false} onChange={jest.fn()} />);
    expect(screen.getByText('Missing')).toBeInTheDocument();
    expect(screen.queryByText('Missing Only')).not.toBeInTheDocument();
  });

  test('renders active label when value is true', () => {
    renderWithProviders(<MissingFilter value={true} onChange={jest.fn()} />);
    expect(screen.getByText('Missing Only')).toBeInTheDocument();
  });

  test('clicking the chip toggles the value on', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(<MissingFilter value={false} onChange={onChange} />);
    await user.click(screen.getByText('Missing'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('clicking the chip toggles the value off', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(<MissingFilter value={true} onChange={onChange} />);
    await user.click(screen.getByText('Missing Only'));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
