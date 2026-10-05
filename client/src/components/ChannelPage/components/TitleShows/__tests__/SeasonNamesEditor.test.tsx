import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SeasonNamesEditor, { SeasonNameRow, rowsToSeasonNames, seasonNamesToRows } from '../SeasonNamesEditor';

describe('SeasonNamesEditor', () => {
  const ROWS: SeasonNameRow[] = [{ season: '1', name: 'Beyblade' }];

  test('names a season', () => {
    const onChange = jest.fn();
    render(<SeasonNamesEditor rows={ROWS} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Name of season 1'), { target: { value: 'Original' } });
    expect(onChange).toHaveBeenCalledWith([{ season: '1', name: 'Original' }]);
  });

  test('adds the next season', () => {
    const onChange = jest.fn();
    render(<SeasonNamesEditor rows={ROWS} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Name a season' }));
    expect(onChange).toHaveBeenCalledWith([...ROWS, { season: '2', name: '' }]);
  });

  test('removes a season name', () => {
    const onChange = jest.fn();
    render(<SeasonNamesEditor rows={ROWS} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove the name of season 1' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  test('flags a season named twice', () => {
    render(<SeasonNamesEditor rows={[{ season: '1', name: 'A' }, { season: '1', name: 'B' }]} onChange={jest.fn()} />);
    expect(screen.getAllByText('Season 1 is named twice')).toHaveLength(2);
  });

  test('flags a season number media servers don\'t read as a season', () => {
    render(<SeasonNamesEditor rows={[{ season: '250', name: 'X' }]} onChange={jest.fn()} />);
    expect(screen.getByText('0-199, or a year 1928-2500')).toBeInTheDocument();
  });

  test('accepts a name for an upload year', () => {
    render(<SeasonNamesEditor rows={[{ season: '2024', name: 'The first year' }]} onChange={jest.fn()} />);
    expect(screen.queryByText('0-199, or a year 1928-2500')).not.toBeInTheDocument();
  });

  test('converts rows to season names, dropping empty ones', () => {
    expect(rowsToSeasonNames([{ season: '2', name: ' V-Force ' }, { season: '3', name: '' }, { season: 'x', name: 'a' }]))
      .toEqual({ 2: 'V-Force' });
  });

  test('lists season names in order', () => {
    expect(seasonNamesToRows({ 3: 'G', 1: 'B' })).toEqual([{ season: '1', name: 'B' }, { season: '3', name: 'G' }]);
  });
});
