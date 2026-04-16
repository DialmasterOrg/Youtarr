import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PlexLibraryLabel } from '../PlexLibraryLabel';

describe('PlexLibraryLabel', () => {
  test('resolved branch renders title and id pair', () => {
    render(
      <PlexLibraryLabel
        display={{ kind: 'resolved', title: 'Movies', id: '7' }}
      />
    );
    expect(screen.getByText('Movies')).toBeInTheDocument();
    expect(screen.getByText('(id: 7)')).toBeInTheDocument();
  });

  test('id-fallback branch renders "Library ID: <id>"', () => {
    render(
      <PlexLibraryLabel display={{ kind: 'id-fallback', id: '42' }} />
    );
    expect(screen.getByText('Library ID: 42')).toBeInTheDocument();
  });

  test('id-only branch renders just the raw id', () => {
    render(<PlexLibraryLabel display={{ kind: 'id-only', id: '99' }} />);
    expect(screen.getByText('99')).toBeInTheDocument();
    expect(screen.queryByText(/Library ID/)).not.toBeInTheDocument();
  });

  test('boldPrimary applies fontWeight 600 to the resolved title', () => {
    render(
      <PlexLibraryLabel
        display={{ kind: 'resolved', title: 'Movies', id: '7' }}
        boldPrimary
      />
    );

    expect(screen.getByText('Movies')).toHaveStyle({ fontWeight: '600' });
  });

  test('boldPrimary applies fontWeight 600 to id-fallback labels', () => {
    render(
      <PlexLibraryLabel
        display={{ kind: 'id-fallback', id: '42' }}
        boldPrimary
      />
    );

    expect(screen.getByText('Library ID: 42')).toHaveStyle({ fontWeight: '600' });
  });

  test('boldPrimary applies fontWeight 600 to id-only labels', () => {
    render(
      <PlexLibraryLabel
        display={{ kind: 'id-only', id: '99' }}
        boldPrimary
      />
    );

    expect(screen.getByText('99')).toHaveStyle({ fontWeight: '600' });
  });

  test('without boldPrimary, primary text is not bold', () => {
    render(
      <PlexLibraryLabel
        display={{ kind: 'id-fallback', id: '42' }}
      />
    );
    expect(screen.getByText('Library ID: 42')).not.toHaveStyle({ fontWeight: '600' });
  });
});
