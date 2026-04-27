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
    onlyLabel: 'Only: Missing',
    excludeLabel: 'Hide: Missing',
  };

  test('renders the inactive label when value is off', () => {
    renderWithProviders(
      <ToggleChipFilter {...defaultProps} value="off" onChange={jest.fn()} />
    );
    expect(screen.getByText('Missing')).toBeInTheDocument();
    expect(screen.queryByText('Only: Missing')).not.toBeInTheDocument();
    expect(screen.queryByText('Hide: Missing')).not.toBeInTheDocument();
  });

  test('renders the only label when value is only', () => {
    renderWithProviders(
      <ToggleChipFilter {...defaultProps} value="only" onChange={jest.fn()} />
    );
    expect(screen.getByText('Only: Missing')).toBeInTheDocument();
    expect(screen.queryByText(/^Missing$/)).not.toBeInTheDocument();
  });

  test('renders the exclude label when value is exclude', () => {
    renderWithProviders(
      <ToggleChipFilter {...defaultProps} value="exclude" onChange={jest.fn()} />
    );
    expect(screen.getByText('Hide: Missing')).toBeInTheDocument();
    expect(screen.queryByText(/^Missing$/)).not.toBeInTheDocument();
  });

  test('clicking from off cycles to only', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(
      <ToggleChipFilter {...defaultProps} value="off" onChange={onChange} />
    );
    await user.click(screen.getByText('Missing'));
    expect(onChange).toHaveBeenCalledWith('only');
  });

  test('clicking from only cycles to exclude', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(
      <ToggleChipFilter {...defaultProps} value="only" onChange={onChange} />
    );
    await user.click(screen.getByText('Only: Missing'));
    expect(onChange).toHaveBeenCalledWith('exclude');
  });

  test('clicking from exclude cycles back to off', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(
      <ToggleChipFilter {...defaultProps} value="exclude" onChange={onChange} />
    );
    await user.click(screen.getByText('Hide: Missing'));
    expect(onChange).toHaveBeenCalledWith('off');
  });

  test('delete icon resets to off from only', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(
      <ToggleChipFilter {...defaultProps} value="only" onChange={onChange} />
    );
    await user.click(screen.getByLabelText('Remove'));
    expect(onChange).toHaveBeenCalledWith('off');
  });

  test('delete icon resets to off from exclude', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(
      <ToggleChipFilter {...defaultProps} value="exclude" onChange={onChange} />
    );
    await user.click(screen.getByLabelText('Remove'));
    expect(onChange).toHaveBeenCalledWith('off');
  });

  test('no delete icon rendered when off', () => {
    renderWithProviders(
      <ToggleChipFilter {...defaultProps} value="off" onChange={jest.fn()} />
    );
    expect(screen.queryByLabelText('Remove')).not.toBeInTheDocument();
  });

  test('renders the provided icon', () => {
    renderWithProviders(
      <ToggleChipFilter {...defaultProps} value="off" onChange={jest.fn()} />
    );
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });
});
