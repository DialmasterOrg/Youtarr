import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PlexLibrarySelector from '../PlexLibrarySelector';
import { PlexLibrary } from '../../utils/plexLibraries';

const LIBRARIES: PlexLibrary[] = [
  { id: '1', title: 'Movies' },
  { id: '2', title: 'TV Shows' },
  { id: '31', title: 'Adults Library' },
];

describe('PlexLibrarySelector', () => {
  const handleClose = jest.fn();
  const setLibraryId = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('pre-selects the currently configured library when it matches a provided library', async () => {
    render(
      <PlexLibrarySelector
        open
        handleClose={handleClose}
        setLibraryId={setLibraryId}
        libraries={LIBRARIES}
        currentLibraryId="31"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Adults Library')).toBeInTheDocument();
    });
  });

  test('does not pre-select when currentLibraryId is not in the provided libraries', async () => {
    render(
      <PlexLibrarySelector
        open
        handleClose={handleClose}
        setLibraryId={setLibraryId}
        libraries={LIBRARIES}
        currentLibraryId="999"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Selection' })).toBeDisabled();
    });
    expect(screen.queryByText('Movies')).not.toBeInTheDocument();
    expect(screen.queryByText('Adults Library')).not.toBeInTheDocument();
  });

  test('does not pre-select when no currentLibraryId is provided', async () => {
    render(
      <PlexLibrarySelector
        open
        handleClose={handleClose}
        setLibraryId={setLibraryId}
        libraries={LIBRARIES}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Selection' })).toBeDisabled();
    });
  });

  test('disables Save Selection when the pre-selected library equals currentLibraryId', async () => {
    render(
      <PlexLibrarySelector
        open
        handleClose={handleClose}
        setLibraryId={setLibraryId}
        libraries={LIBRARIES}
        currentLibraryId="1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Movies')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Save Selection' })).toBeDisabled();
  });

  test('enables Save Selection after the user picks a different library', async () => {
    const user = userEvent.setup();

    render(
      <PlexLibrarySelector
        open
        handleClose={handleClose}
        setLibraryId={setLibraryId}
        libraries={LIBRARIES}
        currentLibraryId="1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Movies')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('Plex Library'));
    await user.click(await screen.findByRole('option', { name: 'TV Shows' }));

    expect(screen.getByRole('button', { name: 'Save Selection' })).toBeEnabled();
  });

  test('calls setLibraryId with the chosen library and title on save', async () => {
    const user = userEvent.setup();

    render(
      <PlexLibrarySelector
        open
        handleClose={handleClose}
        setLibraryId={setLibraryId}
        libraries={LIBRARIES}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Selection' })).toBeDisabled();
    });

    await user.click(screen.getByLabelText('Plex Library'));
    await user.click(await screen.findByRole('option', { name: 'TV Shows' }));
    await user.click(screen.getByRole('button', { name: 'Save Selection' }));

    expect(setLibraryId).toHaveBeenCalledWith({
      libraryId: '2',
      libraryTitle: 'TV Shows',
    });
  });

  test('shows the "Unable to connect" error block when libraries is empty', () => {
    render(
      <PlexLibrarySelector
        open
        handleClose={handleClose}
        setLibraryId={setLibraryId}
        libraries={[]}
      />
    );

    expect(
      screen.getByText('Unable to connect to Plex server. Please check:')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Selection' })).not.toBeInTheDocument();
  });
});
