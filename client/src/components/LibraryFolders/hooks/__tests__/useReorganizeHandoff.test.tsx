import { act, renderHook } from '@testing-library/react';
import { useReorganizeHandoff } from '../useReorganizeHandoff';

jest.mock('../../../shared/Reorganize', () => {
  const actual = jest.requireActual('../../../shared/Reorganize');
  return { ...actual, useReorganizeOutcome: jest.fn() };
});
const { useReorganizeOutcome } = require('../../../shared/Reorganize');

type Finished = (() => void) | null;

function captureFinished(): { current: Finished } {
  const holder: { current: Finished } = { current: null };
  useReorganizeOutcome.mockImplementation((_token: string, operationId: number | null, onFinished: () => void) => {
    if (operationId !== null) holder.current = onFinished;
  });
  return holder;
}

function renderHandoff(overrides: Partial<Parameters<typeof useReorganizeHandoff>[1]> = {}) {
  const options = {
    onSettled: jest.fn(), onLayoutMoving: jest.fn(), onLayoutSettled: jest.fn(), readBackDefault: jest.fn().mockResolvedValue('Kids'),
    ...overrides,
  };
  const { result } = renderHook(() => useReorganizeHandoff('token', options));
  return { result, options };
}

describe('useReorganizeHandoff', () => {
  test('a default change reads the default back at its end, and the read-back alone refreshes', async () => {
    const finished = captureFinished();
    const { result, options } = renderHandoff();

    act(() => { result.current.review({ type: 'defaultSubfolder', value: 'TV' }, { kind: 'default', folder: 'TV' }); });
    expect(result.current.dialogProps.open).toBe(true);
    act(() => { result.current.dialogProps.onApplied?.({ operationId: 5, applied: true }); });
    await act(async () => { finished.current?.(); });

    expect(options.readBackDefault).toHaveBeenCalledTimes(1);
    expect(options.onSettled).not.toHaveBeenCalled();
  });

  test('a default change refreshes once when the read-back fails', async () => {
    const finished = captureFinished();
    const { result, options } = renderHandoff({ readBackDefault: jest.fn().mockResolvedValue(null) });
    act(() => { result.current.review({ type: 'defaultSubfolder', value: 'TV' }, { kind: 'default', folder: 'TV' }); });
    act(() => { result.current.dialogProps.onApplied?.({ operationId: 5, applied: true }); });

    await act(async () => { finished.current?.(); });

    expect(options.onSettled).toHaveBeenCalledTimes(1);
  });

  test('a layout move reports the moving notice for its folder', () => {
    useReorganizeOutcome.mockImplementation(() => undefined);
    const { result, options } = renderHandoff();

    act(() => { result.current.review({ type: 'folderLayout', folder: 'Kids', layout: 'tv' }, { kind: 'layout', folder: 'Kids', target: 'tv' }); });
    act(() => { result.current.dialogProps.onApplied?.({ operationId: 6, applied: true }); });

    expect(options.onLayoutMoving).toHaveBeenCalledWith('Kids', 'tv');
  });

  test('closing a default change reads it back, and the read-back alone refreshes', async () => {
    useReorganizeOutcome.mockImplementation(() => undefined);
    const { result, options } = renderHandoff({ readBackDefault: jest.fn().mockResolvedValue('') });

    act(() => { result.current.review({ type: 'defaultSubfolder', value: 'TV' }, { kind: 'default', folder: 'TV' }); });
    await act(async () => { result.current.dialogProps.onClose(); });

    expect(result.current.dialogProps.open).toBe(false);
    expect(options.readBackDefault).toHaveBeenCalledTimes(1);
    expect(options.onSettled).not.toHaveBeenCalled();
  });

  test('closing a layout change refreshes once', () => {
    useReorganizeOutcome.mockImplementation(() => undefined);
    const { result, options } = renderHandoff();
    act(() => { result.current.review({ type: 'folderLayout', folder: 'Kids', layout: 'tv' }, { kind: 'layout', folder: 'Kids', target: 'tv' }); });

    act(() => { result.current.dialogProps.onClose(); });

    expect(options.onSettled).toHaveBeenCalledTimes(1);
    expect(options.readBackDefault).not.toHaveBeenCalled();
  });

  test('a bare settings change (no operation) does not report a moving layout', () => {
    useReorganizeOutcome.mockImplementation(() => undefined);
    const { result, options } = renderHandoff();
    act(() => { result.current.review({ type: 'folderLayout', folder: 'Kids', layout: 'tv' }, { kind: 'layout', folder: 'Kids', target: 'tv' }); });
    act(() => { result.current.dialogProps.onApplied?.({ operationId: null, applied: true }); });
    expect(options.onLayoutMoving).not.toHaveBeenCalled();
  });

  test('a retried default operation reads the default back again at the retried end', async () => {
    const finished = captureFinished();
    const attempts: number[] = [];
    useReorganizeOutcome.mockImplementation((_t: string, operationId: number | null, onFinished: () => void, options: { attempt: number }) => {
      if (operationId !== null) { finished.current = onFinished; attempts.push(options.attempt); }
    });
    const { result, options } = renderHandoff();
    act(() => { result.current.review({ type: 'defaultSubfolder', value: 'TV' }, { kind: 'default', folder: 'TV' }); });
    act(() => { result.current.dialogProps.onApplied?.({ operationId: 5, applied: true }); });
    await act(async () => { finished.current?.(); });
    act(() => { result.current.dialogProps.onRetried?.(5); });
    expect(attempts[attempts.length - 1]).toBe(1);
    await act(async () => { finished.current?.(); });
    expect(options.readBackDefault).toHaveBeenCalledTimes(2);
  });

  test('a layout operation end refreshes once and settles the moving line, without reading the default back', async () => {
    const finished = captureFinished();
    const { result, options } = renderHandoff();
    act(() => { result.current.review({ type: 'folderLayout', folder: 'Kids', layout: 'tv' }, { kind: 'layout', folder: 'Kids', target: 'tv' }); });
    act(() => { result.current.dialogProps.onApplied?.({ operationId: 6, applied: true }); });

    await act(async () => { finished.current?.(); });

    expect(options.onSettled).toHaveBeenCalledTimes(1);
    expect(options.onLayoutSettled).toHaveBeenCalledWith('Kids', 'tv');
    expect(options.readBackDefault).not.toHaveBeenCalled();
  });

  test('a created TV folder that had to move settles its moving line at the end', async () => {
    const finished = captureFinished();
    const { result, options } = renderHandoff();
    act(() => { result.current.review({ type: 'folderLayout', folder: 'Old', layout: 'tv' }, { kind: 'create', folder: 'Old', target: 'tv' }); });
    act(() => { result.current.dialogProps.onApplied?.({ operationId: 7, applied: true }); });

    await act(async () => { finished.current?.(); });

    expect(options.onLayoutSettled).toHaveBeenCalledWith('Old', 'tv');
  });

  test('names the operation it follows', () => {
    useReorganizeOutcome.mockImplementation(() => undefined);
    const { result } = renderHandoff();
    expect(result.current.trackedOperationId).toBeNull();
    act(() => { result.current.review({ type: 'folderLayout', folder: 'Kids', layout: 'tv' }, { kind: 'layout', folder: 'Kids', target: 'tv' }); });
    act(() => { result.current.dialogProps.onApplied?.({ operationId: 6, applied: true }); });
    expect(result.current.trackedOperationId).toBe(6);
  });
});
