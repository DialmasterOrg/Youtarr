import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConflictList from '../ConflictList';
import { TitleShowConflict } from '../../../../../types/titleShows';

function conflict(extra: Partial<TitleShowConflict> = {}): TitleShowConflict {
  return {
    youtubeId: 'JN49nXLOqQI', kind: 'duplicate', showId: 3, duplicateOf: 'y7xVT7DTt2k', season: 1, episode: 20, message: null,
    suppressed: true, title: 'BEYBLADE EN Episode 20 (2022)', downloaded: false, videoId: null,
    duplicateOfTitle: 'BEYBLADE EN Episode 20 (2020)', ...extra,
  };
}

function renderList(conflicts: TitleShowConflict[]) {
  const handlers = { onUseCopy: jest.fn(), onAssign: jest.fn(), onDelete: jest.fn(), onRecheck: jest.fn() };
  render(<ConflictList conflicts={conflicts} busy={false} {...handlers} />);
  return handlers;
}

describe('ConflictList', () => {
  test('names the episode a duplicate lost and the upload holding it', () => {
    renderList([conflict()]);
    expect(screen.getByText('Duplicate of S01E20: BEYBLADE EN Episode 20 (2020). Ignored, so it isn\'t downloaded.')).toBeInTheDocument();
  });

  test('uses a duplicate\'s copy instead', () => {
    const { onUseCopy } = renderList([conflict()]);
    fireEvent.click(screen.getByRole('button', { name: 'Use this copy instead' }));
    expect(onUseCopy).toHaveBeenCalledWith(expect.objectContaining({ youtubeId: 'JN49nXLOqQI' }));
  });

  test('assigns a video that is not a duplicate by hand', () => {
    const { onAssign } = renderList([conflict()]);
    fireEvent.click(screen.getByRole('button', { name: 'Not a duplicate' }));
    expect(onAssign).toHaveBeenCalledWith(expect.objectContaining({ youtubeId: 'JN49nXLOqQI' }));
  });

  test('offers to delete only a downloaded copy', () => {
    const { onDelete } = renderList([conflict({ downloaded: true, videoId: 8, suppressed: false })]);
    expect(screen.getByText(/Downloaded duplicate/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete this copy' }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ videoId: 8 }));
  });

  test('checks a title that could not be classified again', () => {
    const { onRecheck } = renderList([conflict({ kind: 'classification_error', message: 'timed out', showId: null, duplicateOf: null })]);
    expect(screen.getByText('Its title could not be checked against the shows: timed out')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(onRecheck).toHaveBeenCalled();
  });

  test('renders nothing without conflicts', () => {
    renderList([]);
    expect(screen.queryByText('Duplicates and errors')).not.toBeInTheDocument();
  });
});
