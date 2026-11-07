import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import HiddenDeletedNote from '../HiddenDeletedNote';

function CurrentLocation() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.hash}`}</div>;
}

function renderNote(hiddenDeletedCount: number | null, onShowDeleted: () => void = jest.fn()) {
  return render(
    <MemoryRouter initialEntries={['/videos']}>
      <Routes>
        <Route
          path="/videos"
          element={<HiddenDeletedNote hiddenDeletedCount={hiddenDeletedCount} onShowDeleted={onShowDeleted} />}
        />
        <Route path="/settings/maintenance" element={<CurrentLocation />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('HiddenDeletedNote', () => {
  test('says how many deleted videos are hidden', () => {
    renderNote(3);
    expect(screen.getByText('3 deleted videos hidden.')).toBeInTheDocument();
  });

  test('uses the singular for one hidden video', () => {
    renderNote(1);
    expect(screen.getByText('1 deleted video hidden.')).toBeInTheDocument();
  });

  test('shows the deleted videos when Show is clicked', async () => {
    const onShowDeleted = jest.fn();
    renderNote(3, onShowDeleted);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Show' }));

    expect(onShowDeleted).toHaveBeenCalledTimes(1);
  });

  test('Clean up opens the deleted and missing videos card in Maintenance', async () => {
    renderNote(3);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Clean up' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/settings/maintenance#deleted-and-missing');
  });

  test('explains what Maintenance can do from the info icon', async () => {
    renderNote(3);

    await userEvent.setup().hover(screen.getByRole('button', { name: 'About deleted videos' }));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('empty the trash to remove deleted videos for good');
  });

  test('shows nothing when no deleted video is hidden', () => {
    renderNote(0);
    expect(screen.queryByText(/deleted videos? hidden/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clean up' })).not.toBeInTheDocument();
  });

  test('shows nothing while deleted videos are not hidden', () => {
    renderNote(null);
    expect(screen.queryByRole('button', { name: 'Show' })).not.toBeInTheDocument();
  });
});
