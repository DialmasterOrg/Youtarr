import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArrBridgeListFrame } from '../ArrBridgeListFrame';
import { renderWithProviders } from '../../../../../test-utils';
import { ArrPagedList } from '../../../hooks/useArrBridgePagedList';

const listOf = (overrides: Partial<ArrPagedList<string>> = {}): ArrPagedList<string> => ({
  items: ['a', 'b'],
  total: 2,
  page: 1,
  pageSize: 10,
  query: '',
  loading: false,
  error: null,
  setPage: jest.fn(),
  setQuery: jest.fn(),
  refresh: jest.fn(),
  ...overrides,
});

const setup = (overrides: Partial<ArrPagedList<string>> = {}) => {
  const list = listOf(overrides);
  renderWithProviders(
    <ArrBridgeListFrame
      list={list}
      intro="The newest things first."
      searchLabel="Search things"
      searchHint="A name or an id"
      loadingText="Loading the things..."
      emptyText="No things yet."
      noMatchText="No things match this search."
    >
      <p>The rows</p>
    </ArrBridgeListFrame>
  );
  return list;
};

describe('ArrBridgeListFrame', () => {
  test('shows the intro, the search box with its hint, and the rows', () => {
    setup();

    expect(screen.getByText('The newest things first.')).toBeInTheDocument();
    expect(screen.getByLabelText('Search things')).toHaveValue('');
    expect(screen.getByText('A name or an id')).toBeInTheDocument();
    expect(screen.getByText('The rows')).toBeInTheDocument();
  });

  test('typing in the search box hands on the text', () => {
    const list = setup();

    fireEvent.change(screen.getByLabelText('Search things'), { target: { value: 'bey' } });

    expect(list.setQuery).toHaveBeenCalledWith('bey');
  });

  test('shows the search text the list holds', () => {
    setup({ query: 'beyblade' });

    expect(screen.getByLabelText('Search things')).toHaveValue('beyblade');
  });

  test('Refresh asks for the list again', () => {
    const list = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(list.refresh).toHaveBeenCalledTimes(1);
  });

  test('says which rows of how many are shown', () => {
    setup({ items: ['k', 'l', 'm'], total: 23, page: 3 });

    expect(screen.getByText('21 to 23 of 23')).toBeInTheDocument();
  });

  test('offers the other pages when there is more than one', () => {
    const list = setup({ total: 23, page: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'go to page 3' }));

    expect(list.setPage).toHaveBeenCalledWith(3);
  });

  test('one page needs no page buttons', () => {
    setup({ total: 10 });

    expect(screen.queryByRole('navigation', { name: 'pagination' })).not.toBeInTheDocument();
  });

  test('says so when there is nothing yet', () => {
    setup({ items: [], total: 0 });

    expect(screen.getByText('No things yet.')).toBeInTheDocument();
    expect(screen.queryByText('The rows')).not.toBeInTheDocument();
  });

  test('says so when the search matches nothing', () => {
    setup({ items: [], total: 0, query: 'zzz' });

    expect(screen.getByText('No things match this search.')).toBeInTheDocument();
  });

  test('shows that the first page is loading, with Refresh off', () => {
    setup({ items: [], total: 0, loading: true });

    expect(screen.getByText('Loading the things...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
  });

  test('keeps the rows on screen while another page loads', () => {
    setup({ loading: true });

    expect(screen.getByText('The rows')).toBeInTheDocument();
    expect(screen.queryByText('Loading the things...')).not.toBeInTheDocument();
  });

  test('does not number the rows of the old page with the new page while it loads', () => {
    setup({ items: ['a', 'b'], total: 45, page: 5, loading: true });

    expect(screen.queryByText(/ of 45/)).not.toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'pagination' })).toBeInTheDocument();
  });

  test('shows an error in place of the rows', () => {
    setup({ error: 'Could not load the things.' });

    expect(screen.getByText('Could not load the things.')).toBeInTheDocument();
    expect(screen.queryByText('The rows')).not.toBeInTheDocument();
  });
});
