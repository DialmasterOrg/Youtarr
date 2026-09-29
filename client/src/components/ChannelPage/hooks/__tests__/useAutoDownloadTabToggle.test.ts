import { renderHook, waitFor, act } from '@testing-library/react';
import { useAutoDownloadTabToggle } from '../useAutoDownloadTabToggle';

jest.mock('axios', () => ({
  put: jest.fn(),
  isAxiosError: jest.fn(),
}));

const axios = require('axios');

const savedAs = (value: string) => ({ data: { settings: { auto_download_enabled_tabs: value } } });

interface HookProps {
  channelId: string;
  enabledTabs: string;
}

function renderToggle(initial: HookProps = { channelId: 'UC1', enabledTabs: 'video' }) {
  const onChange = jest.fn();
  const view = renderHook(
    ({ channelId, enabledTabs }: HookProps) => useAutoDownloadTabToggle({
      channelId,
      token: 'token-1',
      enabledTabs,
      onChange,
    }),
    { initialProps: initial }
  );
  return { ...view, onChange };
}

beforeEach(() => {
  jest.clearAllMocks();
  axios.isAxiosError.mockImplementation((err: { isAxiosError?: boolean }) => Boolean(err?.isAxiosError));
});

describe('useAutoDownloadTabToggle', () => {
  test('saves the full tab list with the new tab added', async () => {
    axios.put.mockResolvedValue(savedAs('video,short'));
    const { result } = renderToggle();

    await act(async () => { await result.current.toggleTab('shorts', true); });

    expect(axios.put).toHaveBeenCalledWith(
      '/api/channels/UC1/settings',
      { auto_download_enabled_tabs: 'video,short' },
      { headers: { 'x-access-token': 'token-1' } }
    );
  });

  test('saves the tab list without the removed tab', async () => {
    axios.put.mockResolvedValue(savedAs('short'));
    const { result } = renderToggle({ channelId: 'UC1', enabledTabs: 'video,short' });

    await act(async () => { await result.current.toggleTab('videos', false); });

    expect(axios.put).toHaveBeenCalledWith(
      '/api/channels/UC1/settings',
      { auto_download_enabled_tabs: 'short' },
      expect.anything()
    );
  });

  test('applies the change before the save finishes', async () => {
    let resolveSave: (value: unknown) => void = () => undefined;
    axios.put.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
    const { result, onChange } = renderToggle();

    act(() => { void result.current.toggleTab('shorts', true); });

    expect(onChange).toHaveBeenCalledWith('video,short', 'UC1');
    await act(async () => { resolveSave(savedAs('video,short')); });
  });

  test('applies the value the server saved', async () => {
    axios.put.mockResolvedValue(savedAs('short,video'));
    const { result, onChange } = renderToggle();

    await act(async () => { await result.current.toggleTab('shorts', true); });

    expect(onChange).toHaveBeenLastCalledWith('short,video', 'UC1');
  });

  test('confirms an enabled tab with an undo option', async () => {
    axios.put.mockResolvedValue(savedAs('video,short'));
    const { result } = renderToggle();

    await act(async () => { await result.current.toggleTab('shorts', true); });

    expect(result.current.notice).toEqual({
      message: 'Auto-download on for Shorts',
      severity: 'success',
      undoValue: 'video',
    });
  });

  test('says when the last tab was turned off', async () => {
    axios.put.mockResolvedValue(savedAs(''));
    const { result } = renderToggle();

    await act(async () => { await result.current.toggleTab('videos', false); });

    expect(result.current.notice?.message).toBe('Auto-download is now off for this channel');
  });

  test('warns when the server drops a tab it has not detected', async () => {
    axios.put.mockResolvedValue(savedAs('video'));
    const { result } = renderToggle();

    await act(async () => { await result.current.toggleTab('streams', true); });

    expect(result.current.notice).toEqual({
      message: "Live isn't available for this channel. Use Edit to re-detect tabs.",
      severity: 'warning',
    });
  });

  test('restores the previous value when the save fails', async () => {
    axios.put.mockRejectedValue(new Error('network down'));
    const { result, onChange } = renderToggle();

    await act(async () => { await result.current.toggleTab('shorts', true); });

    expect(onChange).toHaveBeenLastCalledWith('video', 'UC1');
  });

  test('includes the server error in the failure notice', async () => {
    axios.put.mockRejectedValue({ isAxiosError: true, response: { data: { error: 'Channel not found' } } });
    const { result } = renderToggle();

    await act(async () => { await result.current.toggleTab('shorts', true); });

    expect(result.current.notice).toEqual({
      message: "Couldn't update auto-download for Shorts: Channel not found",
      severity: 'error',
    });
  });

  test('ignores a toggle while a save is running', async () => {
    let resolveSave: (value: unknown) => void = () => undefined;
    axios.put.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
    const { result } = renderToggle();

    act(() => { void result.current.toggleTab('shorts', true); });
    await act(async () => { await result.current.toggleTab('streams', true); });

    expect(axios.put).toHaveBeenCalledTimes(1);
    await act(async () => { resolveSave(savedAs('video,short')); });
  });

  test('starting another toggle clears the previous undo', async () => {
    axios.put.mockResolvedValueOnce(savedAs('video,short'));
    const { result } = renderToggle();
    await act(async () => { await result.current.toggleTab('shorts', true); });
    axios.put.mockReturnValueOnce(new Promise(() => undefined));

    act(() => { void result.current.toggleTab('streams', true); });

    expect(result.current.notice).toBeNull();
  });

  test('reports the channel the value was saved for', async () => {
    axios.put.mockResolvedValue(savedAs('video,short'));
    const { result, onChange } = renderToggle({ channelId: 'UC7', enabledTabs: 'video' });

    await act(async () => { await result.current.toggleTab('shorts', true); });

    expect(onChange).toHaveBeenLastCalledWith('video,short', 'UC7');
  });

  test('undo saves the previous value', async () => {
    axios.put.mockResolvedValueOnce(savedAs('video,short')).mockResolvedValueOnce(savedAs('video'));
    const { result } = renderToggle();
    await act(async () => { await result.current.toggleTab('shorts', true); });

    await act(async () => { await result.current.undo(); });

    expect(axios.put).toHaveBeenLastCalledWith(
      '/api/channels/UC1/settings',
      { auto_download_enabled_tabs: 'video' },
      expect.anything()
    );
  });

  test('undo closes the notice', async () => {
    axios.put.mockResolvedValueOnce(savedAs('video,short')).mockResolvedValueOnce(savedAs('video'));
    const { result } = renderToggle();
    await act(async () => { await result.current.toggleTab('shorts', true); });

    await act(async () => { await result.current.undo(); });

    expect(result.current.notice).toBeNull();
  });

  test('does not apply a save that finishes after switching channels', async () => {
    let resolveSave: (value: unknown) => void = () => undefined;
    axios.put.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
    const { result, rerender, onChange } = renderToggle();
    act(() => { void result.current.toggleTab('shorts', true); });

    rerender({ channelId: 'UC2', enabledTabs: 'livestream' });
    onChange.mockClear();
    await act(async () => { resolveSave(savedAs('video,short')); });

    await waitFor(() => expect(result.current.saving).toBe(false));
    expect(onChange).not.toHaveBeenCalled();
  });
});
