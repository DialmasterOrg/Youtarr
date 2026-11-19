import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FlatStructureDialog } from '../FlatStructureDialog';

jest.mock('axios', () => ({ get: jest.fn() }));
const axios = require('axios');

describe('FlatStructureDialog', () => {
  test('shows the count and the channel list, then confirms', async () => {
    axios.get.mockResolvedValue({ data: { count: 1, channelNames: ['Blippi'] } });
    const onConfirm = jest.fn();
    render(<FlatStructureDialog open turningOn token="t" onConfirm={onConfirm} onCancel={jest.fn()} />);
    expect(await screen.findByText('1 tracked channel follows the global setting and will be affected.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show affected channels' }));
    expect(screen.getByText('Blippi')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  test('lists every affected channel when two share a name', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      axios.get.mockResolvedValue({ data: { count: 2, channelNames: ['Same', 'Same'] } });
      render(<FlatStructureDialog open turningOn token="t" onConfirm={jest.fn()} onCancel={jest.fn()} />);
      await userEvent.click(await screen.findByRole('button', { name: 'Show affected channels' }));
      expect(screen.getAllByText('Same')).toHaveLength(2);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  test('still allows confirming when the count fails', async () => {
    axios.get.mockRejectedValue(new Error('down'));
    render(<FlatStructureDialog open turningOn={false} token="t" onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(await screen.findByText(/Could not determine how many channels are affected/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
  });
});
