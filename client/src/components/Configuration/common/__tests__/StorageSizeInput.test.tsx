import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { renderWithProviders } from '../../../../test-utils';
import { StorageSizeInput } from '../StorageSizeInput';

const setupInput = (props: Partial<React.ComponentProps<typeof StorageSizeInput>> = {}) => {
  const onChange = jest.fn();
  renderWithProviders(
    <StorageSizeInput label="Pause when downloads exceed" value="" onChange={onChange} testId="size" {...props} />
  );
  return onChange;
};

describe('StorageSizeInput', () => {
  test('shows the amount of an existing value', () => {
    setupInput({ value: '500GB' });

    expect(screen.getByTestId('size-amount')).toHaveValue(500);
  });

  test('shows an existing megabyte value instead of treating it as off', () => {
    setupInput({ value: '500MB' });

    expect(screen.getByTestId('size-amount')).toHaveValue(500);
  });

  test('keeps the megabyte unit when the amount changes', () => {
    const onChange = setupInput({ value: '500MB' });

    fireEvent.change(screen.getByTestId('size-amount'), { target: { value: '750' } });

    expect(onChange).toHaveBeenCalledWith('750MB');
  });

  test('reports a typed amount with the default GB unit', () => {
    const onChange = setupInput();

    fireEvent.change(screen.getByTestId('size-amount'), { target: { value: '750' } });

    expect(onChange).toHaveBeenCalledWith('750GB');
  });

  test('turns the limit off when the amount is cleared', () => {
    const onChange = setupInput({ value: '500GB' });

    fireEvent.change(screen.getByTestId('size-amount'), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith('');
  });

  test('turns the limit off for a zero amount', () => {
    const onChange = setupInput({ value: '500GB' });

    fireEvent.change(screen.getByTestId('size-amount'), { target: { value: '0' } });

    expect(onChange).toHaveBeenCalledWith('');
  });

  test('keeps the amount when switching units', async () => {
    const onChange = setupInput({ value: '2GB' });

    fireEvent.mouseDown(screen.getByLabelText('Unit'));
    await userEvent.click(await screen.findByRole('option', { name: 'TB' }));

    expect(onChange).toHaveBeenCalledWith('2TB');
  });

  test('applies a unit chosen before any amount is typed', async () => {
    const onChange = setupInput();

    fireEvent.mouseDown(screen.getByLabelText('Unit'));
    await userEvent.click(await screen.findByRole('option', { name: 'TB' }));
    fireEvent.change(screen.getByTestId('size-amount'), { target: { value: '3' } });

    expect(onChange).toHaveBeenLastCalledWith('3TB');
  });

  test('does not report a value when switching units with no amount', async () => {
    const onChange = setupInput();

    fireEvent.mouseDown(screen.getByLabelText('Unit'));
    await userEvent.click(await screen.findByRole('option', { name: 'TB' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
