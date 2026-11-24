import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArrBridgeSearchList } from '../ArrBridgeSearchList';
import { renderWithProviders } from '../../../../../test-utils';
import { ArrSearch, ArrSearchCandidate, ArrSearchStage } from '../../../utils/arrBridgeSearches';
import { ArrPagedList } from '../../../hooks/useArrBridgePagedList';

const candidate = (overrides: Partial<ArrSearchCandidate> = {}): ArrSearchCandidate => ({
  youtubeId: 'g7VYYfoNaf0',
  title: 'BEYBLADE EN Episode 29: Play it Again Dizzi!',
  channelName: 'BEYBLADE Official',
  duration: 1318,
  outcome: 'offered',
  reason: null,
  releaseTitle: 'Beyblade.S01E29.1080p.YT.WEB-DL-BEYBLADEOfficial',
  ...overrides,
});

const rejected = (overrides: Partial<ArrSearchCandidate> = {}): ArrSearchCandidate => candidate({
  youtubeId: 'Ema1nx3zz4g',
  title: 'Episode 29: Play It Again Dizzi!',
  channelName: 'justin fielding',
  duration: 6,
  outcome: 'rejected',
  reason: 'outside-runtime',
  releaseTitle: null,
  ...overrides,
});

const stage = (overrides: Partial<ArrSearchStage> = {}): ArrSearchStage => ({
  matcher: 'episode-title',
  query: 'Beyblade Play It Again Dizzi',
  results: 2,
  candidates: [rejected(), candidate()],
  ...overrides,
});

const search = (overrides: Partial<ArrSearch> = {}): ArrSearch => ({
  id: 1,
  at: '2025-06-10T10:00:00.000Z',
  firstAt: '2025-06-10T10:00:00.000Z',
  count: 1,
  kind: 'tv',
  shape: 'episode',
  asked: { text: 'Beyblade', textSource: 'title', season: 1, episode: 29, year: null, month: null, day: null, limit: 100 },
  outcome: 'offered',
  offered: 1,
  note: null,
  titleStageSkipped: null,
  stages: [stage()],
  ...overrides,
});

const notSearched = (overrides: Partial<ArrSearch> = {}): ArrSearch => search({
  shape: 'empty',
  asked: { ...search().asked, text: 'Bluey', season: null, episode: null },
  outcome: 'not-searched',
  offered: 0,
  note: 'no-season',
  stages: [],
  ...overrides,
});

const setup = (
  { searches = [search()], ...overrides }: Partial<ArrPagedList<ArrSearch>> & { searches?: ArrSearch[] } = {}
) => {
  const list: ArrPagedList<ArrSearch> = {
    items: searches,
    total: searches.length,
    page: 1,
    pageSize: 10,
    query: '',
    loading: false,
    error: null,
    setPage: jest.fn(),
    setQuery: jest.fn(),
    refresh: jest.fn(),
    ...overrides,
  };
  renderWithProviders(<ArrBridgeSearchList list={list} />);
  return list;
};

// Counts searches only while no row is open: an open row holds a list of its own.
const rows = () => within(screen.getByRole('list', { name: 'Recent searches' })).getAllByRole('listitem');
const open = (asked: string) => fireEvent.click(screen.getByRole('button', { name: `Show results for ${asked}` }));

describe('ArrBridgeSearchList', () => {
  test('shows one row per search with what was asked and what came of it', () => {
    setup({ searches: [search(), search({ id: 2, outcome: 'nothing', offered: 0 }), notSearched({ id: 3 })] });

    expect(screen.getAllByText('Beyblade S01E29')).toHaveLength(2);
    expect(screen.getByText('1 offered')).toBeInTheDocument();
    expect(screen.getByText('Nothing offered')).toBeInTheDocument();
    expect(screen.getByText('Not searched')).toBeInTheDocument();
  });

  test('keeps the results folded away until the row is opened', () => {
    setup();

    const button = screen.getByRole('button', { name: 'Show results for Beyblade S01E29' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Beyblade Play It Again Dizzi')).not.toBeInTheDocument();

    fireEvent.click(button);

    expect(screen.getByRole('button', { name: 'Hide results for Beyblade S01E29' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Beyblade Play It Again Dizzi')).toBeInTheDocument();
  });

  test('an open row shows the YouTube search and every result, the offered ones first', () => {
    setup();
    open('Beyblade S01E29');

    expect(screen.getByText("By the episode's title")).toBeInTheDocument();
    expect(screen.getByText(/2 results/)).toBeInTheDocument();
    const results = within(screen.getByRole('list', { name: "Results: By the episode's title" })).getAllByRole('listitem');
    expect(results).toHaveLength(2);

    const first = within(results[0]);
    expect(first.getByRole('link', { name: 'BEYBLADE EN Episode 29: Play it Again Dizzi!' })).toHaveAttribute(
      'href', 'https://www.youtube.com/watch?v=g7VYYfoNaf0'
    );
    expect(first.getByText('BEYBLADE Official, 21:58')).toBeInTheDocument();
    expect(first.getByText('Offered')).toBeInTheDocument();
    expect(first.getByText('Beyblade.S01E29.1080p.YT.WEB-DL-BEYBLADEOfficial')).toBeInTheDocument();

    const second = within(results[1]);
    expect(second.getByText('justin fielding, 0:06')).toBeInTheDocument();
    expect(second.getByText('Its length does not fit the runtime')).toBeInTheDocument();
  });

  test('shows each stage that ran, and why the episode was not searched by its title', () => {
    setup({
      searches: [search({
        outcome: 'nothing',
        offered: 0,
        titleStageSkipped: 'no-connection',
        stages: [stage({ matcher: 'episode-code', query: 'Beyblade S01E29', results: 0, candidates: [] })],
      })],
    });
    open('Beyblade S01E29');

    expect(screen.getByText("Not searched by the episode's title: Sonarr is not connected (step 3).")).toBeInTheDocument();
    expect(screen.getByText('By season and episode')).toBeInTheDocument();
    expect(screen.getByText(/0 results/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /^Results/ })).not.toBeInTheDocument();
  });

  test('a result with a reason this page does not know shows the code, and one without a title its id', () => {
    setup({ searches: [search({ stages: [stage({ candidates: [rejected({ title: null, reason: 'brand-new-reason' })] })] })] });
    open('Beyblade S01E29');

    expect(screen.getByText('brand-new-reason')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ema1nx3zz4g' })).toBeInTheDocument();
  });

  test('a request that ran no search says why, and has nothing to open', () => {
    setup({ searches: [notSearched()] });

    expect(screen.getByText('Bluey')).toBeInTheDocument();
    expect(screen.getByText(/a TV search needs a season/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /results for/ })).not.toBeInTheDocument();
  });

  test('a search that could not run says so', () => {
    setup({ searches: [search({ outcome: 'failed', offered: 0, note: 'search-failed', stages: [] })] });

    expect(screen.getByText('Could not search')).toBeInTheDocument();
    expect(screen.getByText(/The YouTube search failed/)).toBeInTheDocument();
  });

  test('the row for the no-query feed says how often it was asked', () => {
    setup({
      searches: [notSearched({
        shape: 'rss', note: 'no-query', count: 37, asked: { ...search().asked, text: null, season: null, episode: null },
      })],
    });

    expect(screen.getByText('Newest episodes')).toBeInTheDocument();
    expect(screen.getByText(/^Asked 37 times since /)).toBeInTheDocument();
  });

  test('Refresh asks for the list again', () => {
    const list = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(list.refresh).toHaveBeenCalledTimes(1);
  });

  test('the filter box says what it matches and hands on what is typed', () => {
    const list = setup();

    fireEvent.change(screen.getByLabelText('Filter searches'), { target: { value: 'beyblade s01e29' } });

    expect(list.setQuery).toHaveBeenCalledWith('beyblade s01e29');
    expect(screen.getByText(/Matches what was asked for/)).toBeInTheDocument();
  });

  test('says so when the filter matches no search', () => {
    setup({ searches: [], query: 'zzz' });

    expect(screen.getByText('No searches match this filter.')).toBeInTheDocument();
  });

  test('says how long searches are kept, and no longer that a restart empties the list', () => {
    setup();

    expect(screen.getByText(/kept for 30 days/)).toBeInTheDocument();
    expect(screen.queryByText(/restart/)).not.toBeInTheDocument();
  });

  test('says so when nothing was searched yet', () => {
    setup({ searches: [] });

    expect(screen.getByText('No searches yet.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Recent searches' })).not.toBeInTheDocument();
  });

  test('shows that it is loading, with Refresh off', () => {
    setup({ searches: [], loading: true });

    expect(screen.getByText('Loading the recent searches...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
  });

  test('shows an error in place of the list', () => {
    setup({ error: 'Could not load the recent searches.' });

    expect(screen.getByText('Could not load the recent searches.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Recent searches' })).not.toBeInTheDocument();
  });

  describe('a list of several pages', () => {
    const many = (count: number) => Array.from({ length: count }, (_, index) => notSearched({ id: index + 1 }));

    test('shows the page it was given and where that is in the list', () => {
      setup({ searches: many(10), total: 34, page: 2 });

      expect(rows()).toHaveLength(10);
      expect(screen.getByText('11 to 20 of 34')).toBeInTheDocument();
    });

    test('a page button asks for that page', () => {
      const list = setup({ searches: many(10), total: 34, page: 2 });

      fireEvent.click(screen.getByRole('button', { name: 'go to page 4' }));

      expect(list.setPage).toHaveBeenCalledWith(4);
    });
  });
});
