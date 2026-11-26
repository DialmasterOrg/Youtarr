import { act, renderHook, waitFor } from '@testing-library/react';
import axios from 'axios';
import { useChannelTabs } from '../useChannelTabs';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

const mockGet = axios.get as jest.Mock;

type Props = Parameters<typeof useChannelTabs>[0];

const tabsResponse = (availableTabs: string[]) => ({ data: { availableTabs } });
// What axios rejects with when the server answers with an error status.
const errorStatus = (status: number) => ({ response: { status } });
const neverAnswers = () => new Promise(() => {});

describe('useChannelTabs', () => {
  const renderTabs = (props: Partial<Props> = {}) =>
    renderHook((hookProps: Props) => useChannelTabs(hookProps), {
      initialProps: { channelId: 'UC123', token: 'test-token', ...props } as Props,
    });

  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue(tabsResponse(['videos', 'shorts', 'streams']));
  });

  describe('loading the tabs', () => {
    test('has no tabs and no selected tab until the server answers', () => {
      mockGet.mockReturnValue(neverAnswers());

      const { result } = renderTabs();

      expect(result.current).toMatchObject({ availableTabs: [], selectedTab: null });
    });

    test('asks for the channel tabs with the session token', async () => {
      renderTabs();

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/api/channels/UC123/tabs', {
          headers: { 'x-access-token': 'test-token' },
        });
      });
    });

    test('selects the Videos tab when the channel has one', async () => {
      const { result } = renderTabs();

      await waitFor(() => expect(result.current.selectedTab).toBe('videos'));
      expect(result.current.availableTabs).toEqual(['videos', 'shorts', 'streams']);
    });

    test('selects the first tab when the channel has no Videos tab', async () => {
      mockGet.mockResolvedValue(tabsResponse(['shorts', 'streams']));

      const { result } = renderTabs();

      await waitFor(() => expect(result.current.selectedTab).toBe('shorts'));
    });

    test('falls back to a Videos tab when the server lists none', async () => {
      mockGet.mockResolvedValue(tabsResponse([]));

      const { result } = renderTabs();

      await waitFor(() => expect(result.current.selectedTab).toBe('videos'));
      expect(result.current.availableTabs).toEqual(['videos']);
    });

    describe('when the request fails', () => {
      let consoleError: jest.SpyInstance;

      beforeEach(() => {
        consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      });

      afterEach(() => {
        consoleError.mockRestore();
      });

      test('falls back to a Videos tab without logging an error status', async () => {
        mockGet.mockRejectedValue(errorStatus(404));

        const { result } = renderTabs();

        await waitFor(() => expect(result.current.availableTabs).toEqual(['videos']));
        expect(consoleError).not.toHaveBeenCalled();
      });

      test('falls back to a Videos tab when the request got no answer', async () => {
        mockGet.mockRejectedValue(new Error('Network Error'));

        const { result } = renderTabs();

        await waitFor(() => expect(result.current.availableTabs).toEqual(['videos']));
      });

      test('logs a request that got no answer without the request and its session token', async () => {
        // An axios error carries the request it was for.
        const networkError = Object.assign(new Error('Network Error'), {
          config: { headers: { 'x-access-token': 'test-token' } },
        });
        mockGet.mockRejectedValue(networkError);

        renderTabs();

        await waitFor(() => {
          expect(consoleError).toHaveBeenCalledWith('Error fetching available tabs:', { message: 'Network Error' });
        });
      });
    });

    test.each([
      ['a token', { token: null }],
      ['a channel', { channelId: undefined }],
    ])('does not ask without %s', (_case, props) => {
      renderTabs(props);

      expect(mockGet).not.toHaveBeenCalled();
    });

    test('ignores an answer for a channel the page has left', async () => {
      let answerFirstChannel: (response: unknown) => void = () => {};
      mockGet
        .mockImplementationOnce(() => new Promise((resolve) => { answerFirstChannel = resolve; }))
        .mockResolvedValue(tabsResponse(['videos']));
      const { result, rerender } = renderTabs({ channelId: 'UCfirst' });

      rerender({ channelId: 'UCsecond', token: 'test-token' });
      await waitFor(() => expect(result.current.availableTabs).toEqual(['videos']));
      await act(async () => answerFirstChannel(tabsResponse(['shorts', 'streams'])));

      expect(result.current).toMatchObject({ availableTabs: ['videos'], selectedTab: 'videos' });
    });
  });

  describe('while the first request is still waiting', () => {
    let answerFirstRequest: (response: unknown) => void;
    let failFirstRequest: (error: unknown) => void;

    const nextPoll = () =>
      act(async () => {
        jest.advanceTimersByTime(2000);
      });

    beforeEach(() => {
      jest.useFakeTimers();
      mockGet.mockReset();
      mockGet.mockImplementationOnce(
        () => new Promise((resolve, reject) => {
          answerFirstRequest = resolve;
          failFirstRequest = reject;
        })
      );
      mockGet.mockResolvedValue(tabsResponse(['videos', 'shorts']));
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    test('asks again after two seconds and uses that answer', async () => {
      const { result } = renderTabs();

      await nextPoll();

      await waitFor(() => expect(result.current.availableTabs).toEqual(['videos', 'shorts']));
    });

    test('stops asking once the tabs are known', async () => {
      const { result } = renderTabs();
      await nextPoll();
      await waitFor(() => expect(result.current.selectedTab).toBe('videos'));
      const callsWhenKnown = mockGet.mock.calls.length;

      await act(async () => {
        jest.advanceTimersByTime(10000);
      });

      expect(mockGet).toHaveBeenCalledTimes(callsWhenKnown);
    });

    test.each([
      ['an error status', errorStatus(503)],
      ['a request that got no answer', new Error('Network Error')],
    ])('asks again after %s', async (_case, failure) => {
      mockGet.mockRejectedValueOnce(failure);
      const { result } = renderTabs();
      await nextPoll();
      const tabsAfterFailure = result.current.availableTabs;

      await nextPoll();

      await waitFor(() => expect(result.current.availableTabs).toEqual(['videos', 'shorts']));
      expect(tabsAfterFailure).toEqual([]);
    });

    test.each([
      ['answers', () => answerFirstRequest(tabsResponse(['videos', 'shorts', 'streams']))],
      ['fails', () => failFirstRequest(errorStatus(500))],
    ])('keeps the tab the user chose when the first request %s later', async (_case, finishFirstRequest) => {
      const { result } = renderTabs();
      await nextPoll();
      await waitFor(() => expect(result.current.selectedTab).toBe('videos'));
      act(() => result.current.setSelectedTab('shorts'));

      await act(async () => finishFirstRequest());

      expect(result.current).toMatchObject({ availableTabs: ['videos', 'shorts'], selectedTab: 'shorts' });
    });

    test('stops asking after unmount', async () => {
      mockGet.mockRejectedValue(errorStatus(503));
      const { unmount } = renderTabs();
      await nextPoll();
      const callsBeforeUnmount = mockGet.mock.calls.length;

      unmount();
      jest.advanceTimersByTime(10000);

      expect(mockGet).toHaveBeenCalledTimes(callsBeforeUnmount);
    });
  });

  describe('the tab list from the parent', () => {
    const renderWithParentTabs = async (channelAvailableTabs: string | null | undefined) => {
      const view = renderTabs({ channelAvailableTabs });
      await waitFor(() => expect(view.result.current.selectedTab).not.toBeNull());
      return view;
    };
    const parentPasses = (
      rerender: (props: Props) => void,
      channelAvailableTabs: string | null | undefined
    ) => rerender({ channelId: 'UC123', token: 'test-token', channelAvailableTabs });

    test('replaces the tabs when the parent passes a new list', async () => {
      const { result, rerender } = await renderWithParentTabs('videos,shorts,streams');

      parentPasses(rerender, 'videos, streams');

      expect(result.current.availableTabs).toEqual(['videos', 'streams']);
    });

    test('keeps the selected tab when the new list still has it', async () => {
      const { result, rerender } = await renderWithParentTabs('videos,shorts,streams');
      act(() => result.current.setSelectedTab('shorts'));

      parentPasses(rerender, 'videos,shorts');

      expect(result.current.selectedTab).toBe('shorts');
    });

    test('selects Videos when the new list drops the selected tab', async () => {
      const { result, rerender } = await renderWithParentTabs('videos,shorts,streams');
      act(() => result.current.setSelectedTab('shorts'));

      parentPasses(rerender, 'videos,streams');

      expect(result.current.selectedTab).toBe('videos');
    });

    test.each([
      ['undefined', undefined],
      ['null', null],
      ['an empty list', ''],
    ])('leaves the tabs alone when the parent passes %s', async (_case, value) => {
      const { result, rerender } = await renderWithParentTabs('videos,shorts,streams');

      parentPasses(rerender, value);

      expect(result.current.availableTabs).toEqual(['videos', 'shorts', 'streams']);
    });
  });
});
