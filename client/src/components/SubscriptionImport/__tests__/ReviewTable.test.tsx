import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ReviewTable from '../components/ReviewTable';
import { ReviewChannel, RowState, DEFAULT_ROW_SETTINGS } from '../../../types/subscriptionImport';

// Replace child rows with simple stubs so we test ReviewTable's logic in isolation
jest.mock('../components/ReviewTableRow', () => ({
  __esModule: true,
  default: function MockRow({ channel }: { channel: ReviewChannel }) {
    const React = require('react');
    return React.createElement('tr', { 'data-testid': `row-${channel.channelId}` },
      React.createElement('td', null, channel.title)
    );
  },
}));

jest.mock('../components/ReviewTableMobileCard', () => ({
  __esModule: true,
  default: function MockCard({ channel }: { channel: ReviewChannel }) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': `card-${channel.channelId}` }, channel.title);
  },
}));

const mockUseMediaQuery = jest.fn();
jest.mock('../../../hooks/useMediaQuery', () => ({
  __esModule: true,
  default: (q: string) => mockUseMediaQuery(q),
}));

const buildChannels = (count: number, overrides: Partial<ReviewChannel> = {}): ReviewChannel[] =>
  Array.from({ length: count }, (_, i) => ({
    channelId: `UC${i.toString().padStart(3, '0')}`,
    title: `Channel ${i}`,
    url: `https://yt/${i}`,
    thumbnailUrl: null,
    alreadySubscribed: false,
    ...overrides,
  }));

const buildRowStates = (channels: ReviewChannel[], selected: boolean): Record<string, RowState> => {
  const out: Record<string, RowState> = {};
  for (const c of channels) {
    out[c.channelId] = { selected, settings: { ...DEFAULT_ROW_SETTINGS } };
  }
  return out;
};

const renderTable = (
  channels: ReviewChannel[],
  rowStates: Record<string, RowState>,
  dispatch = jest.fn(),
  isMobile = false
) => {
  mockUseMediaQuery.mockReturnValue(isMobile);
  return {
    dispatch,
    ...render(
      <ReviewTable
        channels={channels}
        rowStates={rowStates}
        dispatch={dispatch}
        subfolders={[]}
        defaultSubfolderDisplay={null}
        globalPreferredResolution="1080"
      />
    ),
  };
};

describe('ReviewTable', () => {
  beforeEach(() => {
    mockUseMediaQuery.mockReset();
  });

  test('renders a desktop table row per channel on the current page', () => {
    const channels = buildChannels(3);
    const rowStates = buildRowStates(channels, false);
    renderTable(channels, rowStates, jest.fn(), false);

    expect(screen.getByTestId('row-UC000')).toBeInTheDocument();
    expect(screen.getByTestId('row-UC001')).toBeInTheDocument();
    expect(screen.getByTestId('row-UC002')).toBeInTheDocument();
  });

  test('renders mobile cards instead of a table when on mobile viewport', () => {
    const channels = buildChannels(2);
    const rowStates = buildRowStates(channels, false);
    renderTable(channels, rowStates, jest.fn(), true);

    expect(screen.getByTestId('card-UC000')).toBeInTheDocument();
    expect(screen.getByTestId('card-UC001')).toBeInTheDocument();
    expect(screen.queryByTestId('row-UC000')).not.toBeInTheDocument();
    expect(screen.getByText('2 channels ready for review')).toBeInTheDocument();
  });

  test('paginates after 50 rows and shows page 1 by default', () => {
    const channels = buildChannels(75);
    const rowStates = buildRowStates(channels, false);
    renderTable(channels, rowStates);

    // First page: rows 0-49
    expect(screen.getByTestId('row-UC000')).toBeInTheDocument();
    expect(screen.getByTestId('row-UC049')).toBeInTheDocument();
    // Second page rows should not be visible yet
    expect(screen.queryByTestId('row-UC050')).not.toBeInTheDocument();
  });

  test('header checkbox selects all eligible rows on the page when none are selected', () => {
    const channels = buildChannels(3);
    const rowStates = buildRowStates(channels, false);
    const { dispatch } = renderTable(channels, rowStates);

    fireEvent.click(screen.getByLabelText('Select all on page'));

    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_ROW_SELECTION', payload: 'UC000' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_ROW_SELECTION', payload: 'UC002' });
  });

  test('header checkbox deselects all when every eligible row is already selected', () => {
    const channels = buildChannels(3);
    const rowStates = buildRowStates(channels, true);
    const { dispatch } = renderTable(channels, rowStates);

    fireEvent.click(screen.getByLabelText('Select all on page'));
    expect(dispatch).toHaveBeenCalledTimes(3);
  });

  test('header checkbox toggles only unselected rows when selection is partial', () => {
    const channels = buildChannels(3);
    const rowStates = buildRowStates(channels, false);
    rowStates['UC000'].selected = true;
    const { dispatch } = renderTable(channels, rowStates);

    // Partial state: not all selected, so toggling should select the unselected ones (UC001, UC002)
    fireEvent.click(screen.getByLabelText('Select all on page'));
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_ROW_SELECTION', payload: 'UC001' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_ROW_SELECTION', payload: 'UC002' });
  });

  test('header checkbox does not dispatch for already-subscribed channels', () => {
    const channels = buildChannels(3);
    channels[1].alreadySubscribed = true;
    const rowStates = buildRowStates(channels, false);
    const { dispatch } = renderTable(channels, rowStates);

    fireEvent.click(screen.getByLabelText('Select all on page'));
    // Should toggle UC000 and UC002 only
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_ROW_SELECTION', payload: 'UC000' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_ROW_SELECTION', payload: 'UC002' });
  });

  test('header checkbox does nothing when every visible row is already subscribed', () => {
    const channels = buildChannels(2, { alreadySubscribed: true });
    const rowStates = buildRowStates(channels, false);
    const { dispatch } = renderTable(channels, rowStates);

    fireEvent.click(screen.getByLabelText('Select all on page'));
    expect(dispatch).not.toHaveBeenCalled();
  });
});
