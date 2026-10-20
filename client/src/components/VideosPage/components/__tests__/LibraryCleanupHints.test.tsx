import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import LibraryCleanupHints from '../LibraryCleanupHints';
import type { ChipFilterMode } from '../../../shared/VideoList';

function CurrentLocation() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.hash}`}</div>;
}

interface Props {
  missingFilter?: ChipFilterMode;
  deletedFilter?: ChipFilterMode;
  hasVideos?: boolean;
}

function renderHints({ missingFilter = 'off', deletedFilter = 'exclude', hasVideos = true }: Props = {}) {
  return render(
    <MemoryRouter initialEntries={['/videos']}>
      <Routes>
        <Route
          path="/videos"
          element={<LibraryCleanupHints missingFilter={missingFilter} deletedFilter={deletedFilter} hasVideos={hasVideos} />}
        />
        <Route path="/settings/maintenance" element={<CurrentLocation />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('LibraryCleanupHints', () => {
  describe('missing filter', () => {
    test('points at Mark as deleted while showing only missing videos', () => {
      renderHints({ missingFilter: 'only' });
      expect(screen.getByText(/select them and choose Mark as deleted/)).toBeInTheDocument();
    });

    test('links to marking them all in Maintenance', async () => {
      renderHints({ missingFilter: 'only' });

      await userEvent.setup().click(screen.getByRole('button', { name: 'mark them all in Maintenance' }));

      expect(screen.getByTestId('location')).toHaveTextContent('/settings/maintenance#deleted-and-missing');
    });

    test('stays out of the way while missing videos are not isolated', () => {
      renderHints({ missingFilter: 'off' });
      expect(screen.queryByText(/select them and choose Mark as deleted/)).not.toBeInTheDocument();
    });

    test('says nothing over an empty list', () => {
      renderHints({ missingFilter: 'only', hasVideos: false });
      expect(screen.queryByText(/select them and choose Mark as deleted/)).not.toBeInTheDocument();
    });
  });

  describe('deleted filter', () => {
    test('links to emptying the trash while showing only deleted videos', async () => {
      renderHints({ deletedFilter: 'only' });

      await userEvent.setup().click(screen.getByRole('button', { name: 'empty the trash in Maintenance' }));

      expect(screen.getByTestId('location')).toHaveTextContent('/settings/maintenance#deleted-and-missing');
    });

    test('says nothing over an empty list', () => {
      renderHints({ deletedFilter: 'only', hasVideos: false });
      expect(screen.queryByRole('button', { name: 'empty the trash in Maintenance' })).not.toBeInTheDocument();
    });
  });
});
