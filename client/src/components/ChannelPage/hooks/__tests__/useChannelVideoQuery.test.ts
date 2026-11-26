import { useEffect } from 'react';
import { act, renderHook } from '@testing-library/react';
import { useChannelVideoQuery } from '../useChannelVideoQuery';
import type { ChipFilterMode, FilterConfig } from '../../../shared/VideoList';

type Props = Parameters<typeof useChannelVideoQuery>[0];
type Query = ReturnType<typeof useChannelVideoQuery>;
type ChipFilterId = 'protected' | 'missing' | 'deleted' | 'ignored' | 'downloaded' | 'watched';

const PAGE_SIZE_STORAGE_KEY = 'youtarr.channelVideos.pageSize';

describe('useChannelVideoQuery', () => {
  const baseProps: Props = {
    channelId: 'UC123',
    selectedTab: 'videos',
    search: '',
    useInfiniteScroll: false,
  };

  const renderQuery = (props: Partial<Props> = {}) =>
    renderHook((hookProps: Props) => useChannelVideoQuery(hookProps), {
      initialProps: { ...baseProps, ...props },
    });

  const filterConfig = <Id extends FilterConfig['id']>(query: Query, id: Id) =>
    query.filterConfigs.find((config) => config.id === id) as Extract<FilterConfig, { id: Id }>;

  const setChip = (query: Query, id: ChipFilterId, mode: ChipFilterMode) =>
    act(() => filterConfig(query, id).onChange(mode));

  beforeEach(() => {
    localStorage.removeItem(PAGE_SIZE_STORAGE_KEY);
  });

  test('starts on the first page, newest first, with nothing filtered', () => {
    const { result } = renderQuery();

    expect(result.current).toMatchObject({
      page: 1,
      pageSize: 16,
      sortBy: 'date',
      sortOrder: 'desc',
      isFiltered: false,
    });
  });

  describe('sorting', () => {
    test('choosing the current column again reverses the order', () => {
      const { result } = renderQuery();

      act(() => result.current.changeSort('date'));

      expect(result.current).toMatchObject({ sortBy: 'date', sortOrder: 'asc' });
    });

    test('choosing another column sorts it descending', () => {
      const { result } = renderQuery();
      act(() => result.current.changeSort('date'));

      act(() => result.current.changeSort('title'));

      expect(result.current).toMatchObject({ sortBy: 'title', sortOrder: 'desc' });
    });
  });

  describe('returning to the first page', () => {
    const onPageThree = (props: Partial<Props> = {}) => {
      const view = renderQuery(props);
      act(() => view.result.current.setPage(3));
      return view;
    };

    test('when the sort changes', () => {
      const { result } = onPageThree();

      act(() => result.current.changeSort('title'));

      expect(result.current.page).toBe(1);
    });

    test('when a filter changes', () => {
      const { result } = onPageThree();

      setChip(result.current, 'watched', 'only');

      expect(result.current.page).toBe(1);
    });

    test.each([
      ['the search', { search: 'trailer' }],
      ['the tab', { selectedTab: 'shorts' }],
      ['infinite scroll', { useInfiniteScroll: true }],
    ])('when %s changes', (_case, changed) => {
      const { result, rerender } = onPageThree();

      rerender({ ...baseProps, ...changed });

      expect(result.current.page).toBe(1);
    });

    test('in the same render as the change, so the old page is never requested with it', () => {
      const committed: Array<{ page: number; watched: ChipFilterMode }> = [];
      const { result } = renderHook(() => {
        const query = useChannelVideoQuery(baseProps);
        const { page } = query;
        const watched = query.filters.watchedFilter;
        useEffect(() => {
          committed.push({ page, watched });
        }, [page, watched]);
        return query;
      });
      act(() => result.current.setPage(3));

      setChip(result.current, 'watched', 'only');

      expect(committed).toEqual([
        { page: 1, watched: 'off' },
        { page: 3, watched: 'off' },
        { page: 1, watched: 'only' },
      ]);
    });

    test('when the page size changes', () => {
      const { result } = onPageThree();

      act(() => result.current.changePageSize(32));

      expect(result.current).toMatchObject({ page: 1, pageSize: 32 });
    });
  });

  describe('page size', () => {
    test('uses the stored page size', () => {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, '32');

      const { result } = renderQuery();

      expect(result.current.effectivePageSize).toBe(32);
    });

    test('stores a new page size', () => {
      const { result } = renderQuery();

      act(() => result.current.changePageSize(64));

      expect(localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBe('64');
    });

    test('requests fixed-size pages with infinite scroll whatever the stored size', () => {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, '128');

      const { result } = renderQuery({ useInfiniteScroll: true });

      expect(result.current.effectivePageSize).toBe(16);
    });
  });

  describe('reset key', () => {
    test('changes when a filter changes', () => {
      const { result } = renderQuery();
      const before = result.current.resetKey;

      setChip(result.current, 'downloaded', 'exclude');

      expect(result.current.resetKey).not.toBe(before);
    });

    test('stays the same when only the page changes', () => {
      const { result } = renderQuery();
      const before = result.current.resetKey;

      act(() => result.current.setPage(2));

      expect(result.current.resetKey).toBe(before);
    });
  });

  describe('filters', () => {
    test('gives a new filters object only when a filter value changes', () => {
      const { result } = renderQuery();
      const initial = result.current.filters;
      act(() => result.current.setPage(2));
      const afterPageChange = result.current.filters;

      setChip(result.current, 'missing', 'only');

      expect(afterPageChange).toBe(initial);
      expect(result.current.filters).toMatchObject({ missingFilter: 'only' });
    });

    test.each([
      ['a search', { search: 'trailer' }, () => {}],
      ['a status chip', {}, (query: Query) => setChip(query, 'deleted', 'only')],
      ['a rating limit', {}, (query: Query) => act(() => filterConfig(query, 'maxRating').onChange('PG'))],
      ['a date', {}, (query: Query) => act(() => filterConfig(query, 'dateRange').onFromChange(new Date(2026, 0, 1)))],
    ])('reports the list as filtered by %s', (_case, props, applyFilter) => {
      const { result } = renderQuery(props);

      applyFilter(result.current);

      expect(result.current.isFiltered).toBe(true);
    });

    test('hides the date filter on the Shorts tab', () => {
      const { result } = renderQuery({ selectedTab: 'shorts' });

      expect(filterConfig(result.current, 'dateRange')).toMatchObject({
        hidden: true,
        hiddenReason: 'Shorts do not have date information',
      });
    });

    test('shows the date filter on other tabs', () => {
      const { result } = renderQuery();

      expect(filterConfig(result.current, 'dateRange').hidden).toBe(false);
    });
  });

  describe('a tab change', () => {
    const CHIP_IDS: ChipFilterId[] = ['protected', 'missing', 'deleted', 'ignored', 'downloaded', 'watched'];

    test('turns every status chip off', () => {
      const { result } = renderQuery();
      CHIP_IDS.forEach((id) => setChip(result.current, id, 'only'));

      act(() => result.current.resetForTabChange());

      expect(CHIP_IDS.map((id) => filterConfig(result.current, id).value)).toEqual(
        CHIP_IDS.map(() => 'off')
      );
    });

    test('clears the date filter', () => {
      const { result } = renderQuery();
      act(() => filterConfig(result.current, 'dateRange').onFromChange(new Date(2026, 0, 1)));

      act(() => result.current.resetForTabChange());

      expect(result.current.filters.dateFrom).toBeNull();
    });

    test('keeps the sort and the rating limit', () => {
      const { result } = renderQuery();
      act(() => result.current.changeSort('title'));
      act(() => filterConfig(result.current, 'maxRating').onChange('PG'));

      act(() => result.current.resetForTabChange());

      expect(result.current).toMatchObject({ sortBy: 'title', filters: { maxRating: 'PG' } });
    });
  });
});
