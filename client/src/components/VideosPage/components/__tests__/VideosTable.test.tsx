import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VideosTable from '../VideosTable';
import { VideoData, EnabledChannel } from '../../../../types/VideoData';

jest.mock('../../../shared/RatingBadge', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../shared/ProtectionShieldButton', () => ({
  __esModule: true,
  default: ({ onClick }: { onClick: (e: React.MouseEvent) => void }) => {
    const React2 = require('react');
    return React2.createElement('button', { onClick, 'aria-label': 'protection' }, 'P');
  },
}));
jest.mock('../../../shared/ThumbnailClickOverlay', () => ({
  __esModule: true,
  default: ({ onClick }: { onClick: (e: React.MouseEvent) => void }) => {
    const React2 = require('react');
    return React2.createElement('button', { onClick, 'aria-label': 'thumb-overlay' }, 'O');
  },
}));

const enabledChannels: EnabledChannel[] = [
  { channel_id: 'UC1', uploader: 'Tech Channel' },
];

const sampleVideos: VideoData[] = [
  {
    id: 1,
    youtubeId: 'a',
    youTubeChannelName: 'Tech Channel',
    youTubeVideoName: 'First Video',
    timeCreated: '2024-01-15T10:30:00',
    originalDate: '20240110',
    duration: 300,
    description: null,
    fileSize: '1073741824',
    removed: false,
  },
  {
    id: 2,
    youtubeId: 'b',
    youTubeChannelName: 'Tech Channel',
    youTubeVideoName: 'Removed Video',
    timeCreated: '2024-01-15T10:30:00',
    originalDate: '20240110',
    duration: 600,
    description: null,
    fileSize: null,
    removed: true,
  },
];

const renderTable = (overrides: Partial<React.ComponentProps<typeof VideosTable>> = {}) => {
  const handlers = {
    onSelectAll: jest.fn(),
    onToggleSelect: jest.fn(),
    onSortChange: jest.fn(),
    onOpenModal: jest.fn(),
    onToggleProtection: jest.fn(),
    onDeleteSingle: jest.fn(),
    onImageError: jest.fn(),
  };
  render(
    <MemoryRouter>
      <VideosTable
        videos={sampleVideos}
        selectedVideos={[]}
        enabledChannels={enabledChannels}
        imageErrors={{}}
        orderBy="added"
        sortOrder="desc"
        deleteDisabled={false}
        {...handlers}
        {...overrides}
      />
    </MemoryRouter>
  );
  return handlers;
};

describe('VideosTable', () => {
  test('renders one row per video', () => {
    renderTable();
    expect(screen.getByText('First Video')).toBeInTheDocument();
    expect(screen.getByText('Removed Video')).toBeInTheDocument();
  });

  test('removed video has a disabled checkbox', () => {
    renderTable();
    const removedRowCheckbox = screen.getByRole('checkbox', { name: /Select Removed Video/ });
    expect(removedRowCheckbox).toBeDisabled();
  });

  test('clicking the Published header fires onSortChange with published', () => {
    const { onSortChange } = renderTable();
    fireEvent.click(screen.getByRole('button', { name: /Published/ }));
    expect(onSortChange).toHaveBeenCalledWith('published');
  });

  test('clicking the select-all checkbox fires onSelectAll', () => {
    const { onSelectAll } = renderTable();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all videos' }));
    expect(onSelectAll).toHaveBeenCalledWith(true);
  });

  test('clicking a row body toggles selection for selectable rows', () => {
    const { onToggleSelect } = renderTable();
    fireEvent.click(screen.getByText('First Video'));
    // Title cell stops propagation - row click happens via the underlying tr; click the row directly via the duration cell.
    fireEvent.click(screen.getByText('5m'));
    expect(onToggleSelect).toHaveBeenCalledWith(1);
  });
});
