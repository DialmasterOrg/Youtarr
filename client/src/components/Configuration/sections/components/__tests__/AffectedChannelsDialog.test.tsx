import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DefaultSubfolderDialog, DefaultSubfolderDialogProps, FlatStructureDialog } from '../AffectedChannelsDialog';

jest.mock('axios', () => ({ get: jest.fn() }));
const axios = require('axios');

const mockAffected = (data: { count: number; channelNames: string[] }) => axios.get.mockResolvedValue({ data });

function renderDialog(props: Partial<DefaultSubfolderDialogProps> = {}) {
  return render(
    <DefaultSubfolderDialog open subfolder="Sports" isNew={false} token="t" onConfirm={jest.fn()} onCancel={jest.fn()} {...props} />
  );
}

describe('DefaultSubfolderDialog', () => {
  test('asks the server which channels follow the default subfolder', async () => {
    mockAffected({ count: 0, channelNames: [] });
    renderDialog();
    await screen.findByText('No tracked channels are currently using Default Subfolder.');
    expect(axios.get).toHaveBeenCalledWith('/api/channels/using-default-subfolder', { headers: { 'x-access-token': 't' } });
  });

  test('shows a loading line while the lookup is pending', () => {
    axios.get.mockReturnValue(new Promise(() => {}));
    renderDialog();
    expect(screen.getByText('Checking affected channels...')).toBeInTheDocument();
  });

  test('counts the affected channels', async () => {
    mockAffected({ count: 3, channelNames: ['A', 'B', 'C'] });
    renderDialog();
    expect(await screen.findByText('3 tracked channels configured to use Default Subfolder.')).toBeInTheDocument();
  });

  test('uses the singular for one affected channel', async () => {
    mockAffected({ count: 1, channelNames: ['A'] });
    renderDialog();
    expect(await screen.findByText('1 tracked channel configured to use Default Subfolder.')).toBeInTheDocument();
  });

  test('shows and hides the affected channel names', async () => {
    mockAffected({ count: 2, channelNames: ['Alpha', 'Beta'] });
    renderDialog();
    await userEvent.click(await screen.findByRole('button', { name: 'Show affected channels' }));
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hide affected channels' }));
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
  });

  test('says the count is unknown, not zero, when the lookup fails', async () => {
    axios.get.mockRejectedValue(new Error('down'));
    renderDialog();
    expect(await screen.findByText(/Could not determine how many channels are affected/)).toBeInTheDocument();
    expect(screen.queryByText('No tracked channels are currently using Default Subfolder.')).not.toBeInTheDocument();
  });

  test('names the subfolder downloads will go to', async () => {
    mockAffected({ count: 0, channelNames: [] });
    renderDialog({ subfolder: 'Sports' });
    expect(await screen.findByText('__Sports')).toBeInTheDocument();
  });

  test('names the root directory when no subfolder is chosen', async () => {
    mockAffected({ count: 0, channelNames: [] });
    renderDialog({ subfolder: null });
    expect(await screen.findByText('the root directory')).toBeInTheDocument();
  });

  test('confirms with Set as Default', async () => {
    mockAffected({ count: 0, channelNames: [] });
    const onConfirm = jest.fn();
    renderDialog({ onConfirm });
    await userEvent.click(screen.getByRole('button', { name: 'Set as Default' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  test('cancels with Cancel for an existing subfolder', async () => {
    mockAffected({ count: 0, channelNames: [] });
    const onCancel = jest.fn();
    renderDialog({ onCancel });
    expect(screen.getByText('Set Default Subfolder?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  test('a newly added subfolder gets its own title, notice and decline button', async () => {
    mockAffected({ count: 0, channelNames: [] });
    const onCancel = jest.fn();
    renderDialog({ subfolder: 'NewFolder', isNew: true, onCancel });
    expect(screen.getByText('Set New Subfolder as Default?')).toBeInTheDocument();
    expect(screen.getByText(/has been created and is available anywhere subfolders can be selected/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: "Don't Set as Default" }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('FlatStructureDialog', () => {
  test('shows the count and the channel list, then confirms', async () => {
    axios.get.mockResolvedValue({ data: { count: 1, channelNames: ['Blippi'] } });
    const onConfirm = jest.fn();
    render(<FlatStructureDialog open turningOn token="t" onConfirm={onConfirm} onCancel={jest.fn()} />);
    expect(await screen.findByText('1 tracked channel follows the global setting and will be affected.')).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith('/api/channels/using-global-file-structure', { headers: { 'x-access-token': 't' } });
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

  test('keeps Confirm off while the lookup is pending and allows it when the count fails', async () => {
    let fail: (reason: Error) => void = () => {};
    axios.get.mockReturnValue(new Promise((_resolve, reject) => { fail = reject; }));
    render(<FlatStructureDialog open turningOn={false} token="t" onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    fail(new Error('down'));
    expect(await screen.findByText(/Could not determine how many channels are affected/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
  });
});
