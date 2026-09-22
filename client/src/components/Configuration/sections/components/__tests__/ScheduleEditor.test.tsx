import React, { useState } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../../test-utils';
import { ScheduleEditor } from '../ScheduleEditor';

function setup(initial = '0 2 * * *', options: { warning?: string; disabled?: boolean; error?: string } = {}) {
  const onChange = jest.fn();
  function Editor() {
    const [value, setValue] = useState(initial);
    return <ScheduleEditor
      id="cleanup"
      label="Cleanup"
      value={value}
      defaultValue="0 2 * * *"
      onChange={(next) => { onChange(next); setValue(next); }}
      {...options}
    />;
  }
  return { ...renderWithProviders(<Editor />), onChange };
}

test('converts a daily wall-clock time into cron without timezone conversion', () => {
  const { onChange } = setup();
  const time = screen.getByLabelText('Time (server timezone)');
  expect(time).toHaveValue('02:00');
  fireEvent.change(time, { target: { value: '18:35' } });
  expect(onChange).toHaveBeenLastCalledWith('35 18 * * *');
  expect(time).toHaveValue('18:35');
});

test('clearing a time creates an invalid draft instead of silently resetting it', () => {
  const { onChange } = setup();
  fireEvent.change(screen.getByLabelText('Time (server timezone)'), { target: { value: '' } });
  expect(onChange).toHaveBeenLastCalledWith('');
  expect(screen.getByText('Choose a time.')).toBeInTheDocument();
});

test('opening Custom cron preserves the existing expression', async () => {
  const { onChange } = setup();
  await userEvent.click(screen.getByRole('button', { name: 'Schedule type' }));
  await userEvent.click(screen.getByRole('option', { name: 'Custom cron' }));
  expect(screen.getByLabelText('Cron expression')).toHaveValue('0 2 * * *');
  expect(onChange).not.toHaveBeenCalled();
});

test('custom mode echoes a recognized expression and links to a cron reference', async () => {
  setup();
  await userEvent.click(screen.getByRole('button', { name: 'Schedule type' }));
  await userEvent.click(screen.getByRole('option', { name: 'Custom cron' }));
  expect(screen.getByText('Runs: Daily at 02:00')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'crontab.guru' })).toHaveAttribute('href', 'https://crontab.guru');
});

test('custom mode does not echo an unrecognized expression', () => {
  setup('15 9 * * 1-5');
  expect(screen.queryByText(/^Runs:/)).not.toBeInTheDocument();
});

test('preserves six-field expressions and renders server validation errors', () => {
  const { onChange } = setup('0 15 9 * * 1-5', { error: 'Enter a valid cron expression.' });
  expect(screen.getByLabelText('Cron expression')).toHaveValue('0 15 9 * * 1-5');
  expect(screen.getByText('Enter a valid cron expression.')).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

test('custom mode states the minimum interval between runs', () => {
  setup('15 9 * * 1-5');
  expect(screen.getByText(/at least 15 minutes apart/)).toBeInTheDocument();
});

test('restoring a default updates the draft and returns to the daily editor', async () => {
  const { onChange } = setup('15 9 * * 1-5');
  await userEvent.click(screen.getByRole('button', { name: 'Restore default for Cleanup' }));
  expect(onChange).toHaveBeenLastCalledWith('0 2 * * *');
  expect(screen.getByLabelText('Time (server timezone)')).toHaveValue('02:00');
});

test('offers the sub-hourly presets to every schedule', async () => {
  const { onChange } = setup('0 */4 * * *');
  await userEvent.click(screen.getByRole('button', { name: 'Interval' }));
  await userEvent.click(screen.getByRole('option', { name: 'Every 15 minutes' }));
  expect(onChange).toHaveBeenLastCalledWith('*/15 * * * *');
});

test('shows the warning the caller passes without blocking the choice', () => {
  setup('*/15 * * * *', { warning: 'Every sync lists the full library of each connected media server.' });
  expect(screen.getByRole('alert')).toHaveTextContent('Every sync lists the full library of each connected media server.');
  expect(screen.getByRole('button', { name: 'Interval' })).not.toBeDisabled();
});

test('shows no warning when the caller passes none', () => {
  setup('*/15 * * * *');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('platform-managed schedules cannot be edited or reset', () => {
  setup('0 2 * * *', { disabled: true });
  expect(screen.getByRole('button', { name: 'Schedule type' })).toBeDisabled();
  expect(screen.getByLabelText('Time (server timezone)')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Restore default for Cleanup' })).toBeDisabled();
});
