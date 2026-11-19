import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MainFolderMovedNote } from '../MainFolderMovedNote';
import { ReorganizeOperation } from '../../../../types/reorganize';

const baseOperation: ReorganizeOperation = {
  id: 3, label: 'the main folder', status: 'completed', total: 4, done: 4, failed: 0, failedItems: [],
};
const operation = (status: ReorganizeOperation['status']): ReorganizeOperation => ({ ...baseOperation, status });
const steps = <button type="button">Show the next steps</button>;

describe('MainFolderMovedNote', () => {
  test('asks for a retry before any library change after a partial move', () => {
    render(<MainFolderMovedNote operation={operation('partial')} stepsAction={steps} />);
    expect(screen.getByText(/Retry them above before you change your media server libraries/)).toBeInTheDocument();
  });

  test('offers no library steps after a partial move', () => {
    render(<MainFolderMovedNote operation={operation('partial')} stepsAction={steps} />);
    expect(screen.queryByRole('button', { name: 'Show the next steps' })).not.toBeInTheDocument();
  });

  test('points to the library steps after a completed move', () => {
    render(<MainFolderMovedNote operation={operation('completed')} stepsAction={steps} />);
    expect(screen.getByRole('button', { name: 'Show the next steps' })).toBeInTheDocument();
  });

  test('warns about files still in the downloads folder', () => {
    render(<MainFolderMovedNote operation={operation('completed')} mainFolderHasFiles stepsAction={steps} />);
    expect(screen.getByText(/still holds files the move didn't take/)).toBeInTheDocument();
  });
});
