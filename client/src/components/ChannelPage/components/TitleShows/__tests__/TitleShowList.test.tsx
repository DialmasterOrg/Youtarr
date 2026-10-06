import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TitleShowList from '../TitleShowList';
import { TitleShow } from '../../../../../types/titleShows';

function show(id: number, extra: Partial<TitleShow> = {}): TitleShow {
  return {
    id, name: `Show ${id}`, folderName: `Show ${id}`, libraryFolder: 'TV', position: id, retired: false, excludeTerms: [],
    seasonNames: {}, patterns: [], counts: { episodes: 51, downloaded: 49, duplicates: 22, unsupported: 0 }, ...extra,
  };
}

function renderList(props: Partial<React.ComponentProps<typeof TitleShowList>> = {}) {
  const handlers = { onEdit: jest.fn(), onRemove: jest.fn(), onRestore: jest.fn(), onMove: jest.fn() };
  render(<TitleShowList shows={[show(3), show(4)]} retired={[]} busy={false} {...handlers} {...props} />);
  return handlers;
}

describe('TitleShowList', () => {
  // Not "ignored": a downloaded duplicate is kept, never ignored.
  test('summarizes each show\'s episodes', () => {
    renderList();
    expect(screen.getAllByText('51 episodes, 49 downloaded, 22 duplicates')).toHaveLength(2);
    expect(screen.getByText('__TV/Show 3')).toBeInTheDocument();
  });

  test('edits a show', () => {
    const { onEdit } = renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Show 3' }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });

  test('moves a show down the order', () => {
    const { onMove } = renderList();
    expect(screen.getByRole('button', { name: 'Move Show 3 up' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Move Show 3 down' }));
    expect(onMove).toHaveBeenCalledWith(0, 1);
  });

  test('asks before removing a show', () => {
    const { onRemove } = renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Show 3' }));
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });

  test('restores a removed show', () => {
    const { onRestore } = renderList({ retired: [show(5, { retired: true })] });
    fireEvent.click(screen.getByRole('button', { name: 'Restore Show 5' }));
    expect(onRestore).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
  });

  test('says when the channel has no shows', () => {
    renderList({ shows: [] });
    expect(screen.getByText(/No shows yet/)).toBeInTheDocument();
  });
});
