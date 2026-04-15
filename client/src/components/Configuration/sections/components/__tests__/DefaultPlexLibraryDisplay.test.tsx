import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DefaultPlexLibraryDisplay } from '../DefaultPlexLibraryDisplay';
import { PlexLibrary } from '../../../../../utils/plexLibraries';

const LIBRARIES: PlexLibrary[] = [
  { id: '1', title: 'Movies' },
  { id: '7', title: 'YouTube' },
];

describe('DefaultPlexLibraryDisplay', () => {
  test('renders resolved title with id when libraryId matches a library', () => {
    render(
      <DefaultPlexLibraryDisplay
        libraries={LIBRARIES}
        libraryId="7"
        plexConnectionStatus="connected"
        hasPlexServerConfigured
        hasPlexApiKey
      />
    );
    expect(screen.getByRole('heading', { name: 'Default Plex Library' })).toBeInTheDocument();
    expect(screen.getByText('YouTube')).toBeInTheDocument();
    expect(screen.getByText('(id: 7)')).toBeInTheDocument();
  });

  test('renders id-fallback when libraries are empty (offline) and a libraryId is set', () => {
    render(
      <DefaultPlexLibraryDisplay
        libraries={[]}
        libraryId="7"
        plexConnectionStatus="not_connected"
        hasPlexServerConfigured
        hasPlexApiKey
      />
    );
    expect(screen.getByText('Library ID: 7')).toBeInTheDocument();
    expect(screen.getByTestId('default-library-unreachable-warning')).toBeInTheDocument();
    expect(
      screen.getByText('Cannot reach Plex; showing saved library ID.')
    ).toBeInTheDocument();
  });

  test('renders id-only (no warning) when libraries populated but id missing from list', () => {
    render(
      <DefaultPlexLibraryDisplay
        libraries={LIBRARIES}
        libraryId="999"
        plexConnectionStatus="connected"
        hasPlexServerConfigured
        hasPlexApiKey
      />
    );
    expect(screen.getByText('999')).toBeInTheDocument();
    expect(screen.queryByText(/Library ID:/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('default-library-unreachable-warning')).not.toBeInTheDocument();
  });

  test('does NOT render the unreachable warning when status is connected', () => {
    render(
      <DefaultPlexLibraryDisplay
        libraries={LIBRARIES}
        libraryId="7"
        plexConnectionStatus="connected"
        hasPlexServerConfigured
        hasPlexApiKey
      />
    );
    expect(screen.queryByTestId('default-library-unreachable-warning')).not.toBeInTheDocument();
  });

  test('shows "No Default Plex Library Configured" when libraryId is missing and Plex is configured', () => {
    render(
      <DefaultPlexLibraryDisplay
        libraries={[]}
        libraryId={undefined}
        plexConnectionStatus="not_tested"
        hasPlexServerConfigured
        hasPlexApiKey
      />
    );
    expect(screen.getByTestId('no-default-library-warning')).toBeInTheDocument();
    expect(screen.getByText('No Default Plex Library Configured')).toBeInTheDocument();
  });

  test('renders nothing when libraryId missing AND plex not yet configured', () => {
    const { container } = render(
      <DefaultPlexLibraryDisplay
        libraries={[]}
        libraryId={undefined}
        plexConnectionStatus="not_tested"
        hasPlexServerConfigured={false}
        hasPlexApiKey={false}
      />
    );
    expect(screen.queryByTestId('no-default-library-warning')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Default Plex Library' })).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing when libraryId missing AND plex configured but no api key', () => {
    const { container } = render(
      <DefaultPlexLibraryDisplay
        libraries={[]}
        libraryId={undefined}
        plexConnectionStatus="not_tested"
        hasPlexServerConfigured
        hasPlexApiKey={false}
      />
    );
    expect(screen.queryByTestId('no-default-library-warning')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
