import { act, renderHook } from '@testing-library/react';
import { useLayoutChange } from '../useLayoutChange';
import { ReorganizeRequiredError } from '../../../shared/Reorganize';

jest.mock('axios', () => ({ get: jest.fn(), isAxiosError: () => false }));
const axios = require('axios');

describe('useLayoutChange', () => {
  test('reports success for the folder', async () => {
    const setFolderLayout = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useLayoutChange({ token: 'token', setFolderLayout, review: jest.fn() }));
    await act(async () => { await result.current.changeLayout('Kids', 'tv'); });
    expect(result.current.result).toEqual({ folder: 'Kids', tone: 'success', text: 'Now a TV shows folder.' });
  });

  test('hands a reorganize refusal to the review', async () => {
    const change = { type: 'folderLayout' as const, folder: 'Kids', layout: 'tv' as const };
    const review = jest.fn();
    const setFolderLayout = jest.fn().mockRejectedValue(new ReorganizeRequiredError('Review the move', change));
    const { result } = renderHook(() => useLayoutChange({ token: 'token', setFolderLayout, review }));
    await act(async () => { await result.current.changeLayout('Kids', 'tv'); });
    expect(review).toHaveBeenCalledWith(change, { kind: 'layout', folder: 'Kids', target: 'tv' });
    expect(result.current.result).toBeNull();
  });

  test('shows a refusal message', async () => {
    const setFolderLayout = jest.fn().mockRejectedValue(new Error('Wait for the current download to finish'));
    const { result } = renderHook(() => useLayoutChange({ token: 'token', setFolderLayout, review: jest.fn() }));
    await act(async () => { await result.current.changeLayout('Kids', 'tv'); });
    expect(result.current.result).toEqual({ folder: 'Kids', tone: 'warning', text: 'Wait for the current download to finish' });
  });

  describe('when a move ends', () => {
    const renderMoving = () => {
      const { result } = renderHook(() => useLayoutChange({ token: 'token', setFolderLayout: jest.fn(), review: jest.fn() }));
      act(() => { result.current.showMoving('Kids', 'tv'); });
      return { result };
    };

    test('the folder now in its new layout reads as switched', async () => {
      axios.get.mockResolvedValue({ data: { folders: [{ name: '', layout: 'videos' }, { name: 'kids', layout: 'tv' }] } });
      const { result } = renderMoving();
      await act(async () => { await result.current.settleMoving('Kids', 'tv'); });
      expect(result.current.result).toEqual({ folder: 'Kids', tone: 'success', text: 'Now a TV shows folder.' });
    });

    test('a move the server undid clears the moving line', async () => {
      axios.get.mockResolvedValue({ data: { folders: [{ name: 'Kids', layout: 'videos' }] } });
      const { result } = renderMoving();
      await act(async () => { await result.current.settleMoving('Kids', 'tv'); });
      expect(result.current.result).toBeNull();
    });

    test('a later result for another folder stays', async () => {
      axios.get.mockResolvedValue({ data: { folders: [{ name: 'Kids', layout: 'tv' }] } });
      const setFolderLayout = jest.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useLayoutChange({ token: 'token', setFolderLayout, review: jest.fn() }));
      act(() => { result.current.showMoving('Kids', 'tv'); });
      await act(async () => { await result.current.changeLayout('Docs', 'tv'); });
      await act(async () => { await result.current.settleMoving('Kids', 'tv'); });
      expect(result.current.result).toEqual({ folder: 'Docs', tone: 'success', text: 'Now a TV shows folder.' });
    });
  });
});
