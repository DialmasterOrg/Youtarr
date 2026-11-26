import { act, renderHook } from '@testing-library/react';
import { useChannelVideoOverrides } from '../useChannelVideoOverrides';
import { ChannelVideo } from '../../../../types/ChannelVideo';

const video = (youtubeId: string, overrides: Partial<ChannelVideo> = {}): ChannelVideo => ({
  title: `Video ${youtubeId}`,
  youtube_id: youtubeId,
  publishedAt: null,
  published_at_source: 'estimated',
  thumbnail: `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`,
  added: false,
  duration: 300,
  media_type: 'video',
  live_status: null,
  ...overrides,
});

describe('useChannelVideoOverrides', () => {
  const firstPage = [video('one'), video('two')];

  type Props = Parameters<typeof useChannelVideoOverrides>[0];
  const pagedList: Props = { videos: firstPage, resetKey: 'videos', page: 1, appendsPages: false };
  const infiniteList: Props = { ...pagedList, appendsPages: true };

  const renderOverrides = (videos: ChannelVideo[] = firstPage, list: Props = pagedList) =>
    renderHook((props: Props) => useChannelVideoOverrides(props), {
      initialProps: { ...list, videos },
    });

  // A row toggled on each kind, so one check covers both.
  const renderWithToggles = (list: Props) => {
    const view = renderOverrides(firstPage, list);
    act(() => {
      view.result.current.setIgnored({ one: true });
      view.result.current.setProtected('two', true);
    });
    return view;
  };
  const toggles = (videos: ChannelVideo[]) => videos.map((v) => [v.ignored, v.protected]);
  const TOGGLES_SHOWN = [[true, undefined], [undefined, true]];
  const TOGGLES_DROPPED = [[undefined, undefined], [undefined, undefined]];

  const row = (videos: ChannelVideo[], youtubeId: string) =>
    videos.find((candidate) => candidate.youtube_id === youtubeId);

  test('returns the loaded rows themselves when nothing changed locally', () => {
    const { result } = renderOverrides();

    expect(result.current.videos[0]).toBe(firstPage[0]);
  });

  test('shows an ignored video as ignored, with the time it was ignored', () => {
    const { result } = renderOverrides();

    act(() => result.current.setIgnored({ one: true }));

    expect(row(result.current.videos, 'one')).toMatchObject({
      ignored: true,
      ignored_at: expect.any(String),
    });
  });

  test('shows an unignored video without an ignored time', () => {
    const { result } = renderOverrides([video('one', { ignored: true, ignored_at: '2026-01-01T00:00:00Z' })]);

    act(() => result.current.setIgnored({ one: false }));

    expect(row(result.current.videos, 'one')).toMatchObject({ ignored: false, ignored_at: null });
  });

  test('changes only the rows it was given', () => {
    const { result } = renderOverrides();

    act(() => result.current.setIgnored({ one: true }));

    expect(row(result.current.videos, 'two')).toBe(firstPage[1]);
  });

  test('shows a protection change', () => {
    const { result } = renderOverrides();

    act(() => result.current.setProtected('two', true));

    expect(row(result.current.videos, 'two')?.protected).toBe(true);
  });

  test('shows the availability found for a video', () => {
    const { result } = renderOverrides();

    act(() => result.current.setAvailability('one', 'subscriber_only', 'denied'));

    expect(row(result.current.videos, 'one')).toMatchObject({
      availability: 'subscriber_only',
      members_access: 'denied',
    });
  });

  test('shows a publish date found for a video as exact', () => {
    const { result } = renderOverrides();

    act(() => result.current.setPublishedAt('one', '2026-03-04T00:00:00Z'));

    expect(row(result.current.videos, 'one')).toMatchObject({
      publishedAt: '2026-03-04T00:00:00Z',
      published_at_source: 'exact',
    });
  });

  describe('ignore and protection toggles', () => {
    test.each([
      ['a paged list', pagedList],
      ['an infinite list', infiniteList],
    ])('are dropped when %s restarts from its first page', (_case, list) => {
      const { result, rerender } = renderWithToggles(list);

      rerender({ ...list, resetKey: 'shorts' });

      expect(toggles(result.current.videos)).toEqual(TOGGLES_DROPPED);
    });

    test('are dropped when a paged list moves to another page', () => {
      const { result, rerender } = renderWithToggles(pagedList);

      rerender({ ...pagedList, page: 2 });

      expect(toggles(result.current.videos)).toEqual(TOGGLES_DROPPED);
    });

    test('are kept when an infinite list adds its next page below', () => {
      const { result, rerender } = renderWithToggles(infiniteList);

      rerender({ ...infiniteList, page: 2, videos: [...firstPage, video('three')] });

      expect(toggles(result.current.videos)).toEqual([...TOGGLES_SHOWN, [undefined, undefined]]);
    });

    test('are dropped when an infinite list goes back to its first page', () => {
      const { result, rerender } = renderWithToggles({ ...infiniteList, page: 2 });

      rerender({ ...infiniteList, page: 1 });

      expect(toggles(result.current.videos)).toEqual(TOGGLES_DROPPED);
    });

    test('are kept when the page already showing is loaded again', () => {
      const { result, rerender } = renderWithToggles(pagedList);

      rerender({ ...pagedList, videos: [...firstPage] });

      expect(toggles(result.current.videos)).toEqual(TOGGLES_SHOWN);
    });
  });

  test('keeps what was found out about a video when the list is replaced', () => {
    const { result, rerender } = renderOverrides();
    act(() => {
      result.current.setAvailability('one', 'subscriber_only', 'confirmed');
      result.current.setPublishedAt('two', '2026-03-04T00:00:00Z');
    });

    rerender({ ...pagedList, resetKey: 'shorts', page: 2 });

    expect(result.current.videos).toMatchObject([
      { availability: 'subscriber_only' },
      { publishedAt: '2026-03-04T00:00:00Z' },
    ]);
  });
});
