import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChannelVideosContent from '../ChannelVideosContent';
import { ChannelVideo } from '../../../../types/ChannelVideo';

jest.mock('../../VideoCard', () => ({
  __esModule: true,
  default: function MockVideoCard(props: {
    video: { youtube_id: string };
    hoveredVideo: string | null;
    selectionMode: string | null;
    onHoverChange: (id: string | null) => void;
    onToggleIgnore: (id: string) => void;
    onVideoClick: (video: unknown) => void;
  }) {
    const React = require('react');
    const id = props.video.youtube_id;
    return React.createElement(
      'div',
      {
        'data-testid': `card-${id}`,
        'data-hovered': String(props.hoveredVideo === id),
        'data-selection-mode': String(props.selectionMode),
      },
      React.createElement('button', { onClick: () => props.onHoverChange(id) }, `Hover ${id}`),
      React.createElement('button', { onClick: () => props.onToggleIgnore(id) }, `Ignore ${id}`),
      React.createElement('button', { onClick: () => props.onVideoClick(props.video) }, `Open ${id}`)
    );
  },
}));

jest.mock('../../VideoListItem', () => ({
  __esModule: true,
  default: function MockVideoListItem(props: { video: { youtube_id: string }; selectionMode: string | null }) {
    const React = require('react');
    return React.createElement('div', {
      'data-testid': `list-item-${props.video.youtube_id}`,
      'data-selection-mode': String(props.selectionMode),
    });
  },
}));

jest.mock('../../VideoTableView', () => ({
  __esModule: true,
  default: function MockVideoTableView(props: {
    videos: unknown[];
    sortBy: string;
    sortOrder: string;
    onSelectAll: () => void;
    onClearSelection: () => void;
    onSortChange: (sortBy: string) => void;
  }) {
    const React = require('react');
    return React.createElement(
      'div',
      { 'data-testid': 'table', 'data-sort': `${props.sortBy} ${props.sortOrder}` },
      `${props.videos.length} rows`,
      React.createElement('button', { onClick: props.onSelectAll }, 'Select all'),
      React.createElement('button', { onClick: props.onClearSelection }, 'Clear selection'),
      React.createElement('button', { onClick: () => props.onSortChange('title') }, 'Sort by title')
    );
  },
}));

type Props = React.ComponentProps<typeof ChannelVideosContent>;

const video = (youtubeId: string): ChannelVideo => ({
  title: `Video ${youtubeId}`,
  youtube_id: youtubeId,
  publishedAt: '2023-01-01T00:00:00Z',
  thumbnail: `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`,
  added: false,
  duration: 300,
  media_type: 'video',
  live_status: null,
});

describe('ChannelVideosContent', () => {
  const videos = [video('one'), video('two')];
  const selection: Props['selection'] = {
    checkedBoxes: ['one'],
    selectedForDeletion: [],
    selectionMode: 'download',
    onCheckChange: jest.fn(),
    onDeletionChange: jest.fn(),
    selectAll: jest.fn(),
    clearAll: jest.fn(),
  };
  const onSortChange = jest.fn();
  const onToggleIgnore = jest.fn();
  const onVideoClick = jest.fn();

  const renderContent = (viewMode: Props['viewMode']) =>
    render(
      <ChannelVideosContent
        viewMode={viewMode}
        videos={videos}
        isMobile={false}
        selection={selection}
        sortBy="date"
        sortOrder="desc"
        onSortChange={onSortChange}
        onToggleIgnore={onToggleIgnore}
        onToggleProtection={jest.fn()}
        onMobileTooltip={jest.fn()}
        onVideoClick={onVideoClick}
      />
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('grid view', () => {
    test('shows a card for each video, in the current selection mode', () => {
      renderContent('grid');

      expect(screen.getByTestId('card-one')).toHaveAttribute('data-selection-mode', 'download');
      expect(screen.getByTestId('card-two')).toBeInTheDocument();
    });

    test('tells the cards which one the pointer is over', async () => {
      renderContent('grid');

      await userEvent.click(screen.getByRole('button', { name: 'Hover two' }));

      expect(screen.getByTestId('card-one')).toHaveAttribute('data-hovered', 'false');
      expect(screen.getByTestId('card-two')).toHaveAttribute('data-hovered', 'true');
    });

    test('passes a row action on with the video it is for', async () => {
      renderContent('grid');

      await userEvent.click(screen.getByRole('button', { name: 'Ignore two' }));

      expect(onToggleIgnore).toHaveBeenCalledWith('two');
    });

    test('reports the video that was opened', async () => {
      renderContent('grid');

      await userEvent.click(screen.getByRole('button', { name: 'Open one' }));

      expect(onVideoClick).toHaveBeenCalledWith(videos[0]);
    });
  });

  test('list view shows a list row for each video', () => {
    renderContent('list');

    expect(screen.getByTestId('list-item-one')).toHaveAttribute('data-selection-mode', 'download');
    expect(screen.getByTestId('list-item-two')).toBeInTheDocument();
  });

  describe('table view', () => {
    test('shows every video in one table with the current sort', () => {
      renderContent('table');

      expect(screen.getByTestId('table')).toHaveTextContent('2 rows');
      expect(screen.getByTestId('table')).toHaveAttribute('data-sort', 'date desc');
    });

    test('its header checkbox selects and clears through the selection', async () => {
      renderContent('table');

      await userEvent.click(screen.getByRole('button', { name: 'Select all' }));
      await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));

      expect(selection.selectAll).toHaveBeenCalledTimes(1);
      expect(selection.clearAll).toHaveBeenCalledTimes(1);
    });

    test('reports the column to sort by', async () => {
      renderContent('table');

      await userEvent.click(screen.getByRole('button', { name: 'Sort by title' }));

      expect(onSortChange).toHaveBeenCalledWith('title');
    });
  });
});
