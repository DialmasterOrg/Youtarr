import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ToggleChipFilter from '../ToggleChipFilter';
import { renderWithProviders } from '../../../../../test-utils';

function Icon() {
  return <span data-testid="test-icon" />;
}

describe('ToggleChipFilter', () => {
  const defaultProps = {
    icon: <Icon />,
    inactiveLabel: 'Missing',
    activeLabel: 'Missing Only',
  };

  test('renders the inactive label when value is false', () => {
    renderWithProviders(
      <ToggleChipFilter {...defaultProps} value={false} onChange={jest.fn()} />
    );
    expect(screen.getByText('Missing')).toBeInTheDocument();
    expect(screen.queryByText('Missing Only')).not.toBeInTheDocument();
  });

  test('renders the active label when value is true', () => {
    renderWithProviders(
      <ToggleChipFilter {...defaultProps} value={true} onChange={jest.fn()} />
    );
    expect(screen.getByText('Missing Only')).toBeInTheDocument();
    expect(screen.queryByText(/^Missing$/)).not.toBeInTheDocument();
  });

  test('clicking the chip toggles the value on', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(
      <ToggleChipFilter {...defaultProps} value={false} onChange={onChange} />
    );
    await user.click(screen.getByText('Missing'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('clicking the chip toggles the value off', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(
      <ToggleChipFilter {...defaultProps} value={true} onChange={onChange} />
    );
    await user.click(screen.getByText('Missing Only'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  test('renders the provided icon', () => {
    renderWithProviders(
      <ToggleChipFilter {...defaultProps} value={false} onChange={jest.fn()} />
    );
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });
});
