import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { LibraryCheckNotes } from '../LibraryCheckNotes';
import { LibraryCheckFolder, LibraryCheckServer, LibraryCheckServerReport } from '../../../../types/libraryCheck';

const SERVERS: LibraryCheckServer[] = [
  { serverType: 'plex', name: 'Plex', reachable: true, error: null },
  { serverType: 'jellyfin', name: 'Jellyfin', reachable: true, error: null },
  { serverType: 'emby', name: 'Emby', reachable: false, error: 'connect ECONNREFUSED' },
];

const report = (overrides: Partial<LibraryCheckServerReport>): LibraryCheckServerReport => ({
  serverType: 'plex',
  status: 'ok',
  libraries: [{ id: '41', name: 'YouTube TV', type: 'tv', location: 'Q:\\Y\\__TV', relation: 'exact' }],
  issues: [],
  ...overrides,
});

const tvFolder = (servers: LibraryCheckServerReport[]): LibraryCheckFolder => ({
  name: 'TV', layout: 'tv', hasFiles: true, channels: 1, servers,
});

function itemFor(serverName: string): HTMLElement {
  const item = screen.getAllByRole('listitem').find((entry) => within(entry).queryByText(`${serverName}:`));
  if (!item) throw new Error(`No line for ${serverName}`);
  return item;
}

describe('LibraryCheckNotes', () => {
  test("names the library that holds the folder on each server", () => {
    render(<LibraryCheckNotes folder={tvFolder([report({})])} servers={SERVERS} />);

    expect(itemFor('Plex')).toHaveTextContent('YouTube TV');
  });

  test('lists the issues the server reported', () => {
    render(<LibraryCheckNotes
      folder={tvFolder([report({ status: 'warning', issues: [{ code: 'plexSeriesAgent', message: 'YouTube TV uses the Plex Series agent.' }] })])}
      servers={SERVERS}
    />);

    expect(within(itemFor('Plex')).getByText('YouTube TV uses the Plex Series agent.')).toBeInTheDocument();
  });

  test('lists two issues of the same kind without complaint', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<LibraryCheckNotes
      folder={tvFolder([report({
        status: 'warning',
        issues: [
          { code: 'duplicateLibrary', message: 'TV A, TV B all point at __TV.' },
          { code: 'duplicateLibrary', message: 'TV C, TV D all point at __TV.' },
        ],
      })])}
      servers={SERVERS}
    />);

    const item = itemFor('Plex');
    expect(within(item).getByText('TV A, TV B all point at __TV.')).toBeInTheDocument();
    expect(within(item).getByText('TV C, TV D all point at __TV.')).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  test('says how to add a TV library during setup', () => {
    render(<LibraryCheckNotes
      folder={tvFolder([report({ serverType: 'jellyfin', status: 'missing', libraries: [], issues: [{ code: 'noLibrary', message: 'No Jellyfin Shows library holds __TV.' }] })])}
      servers={SERVERS}
      showSetupHints
    />);

    const item = itemFor('Jellyfin');
    expect(item).toHaveTextContent('no TV library holds this folder');
    expect(item).toHaveTextContent('Add a Shows library for __TV');
  });

  test('leaves out the setup steps outside setup', () => {
    render(<LibraryCheckNotes
      folder={tvFolder([report({ serverType: 'jellyfin', status: 'missing', libraries: [] })])}
      servers={SERVERS}
    />);

    expect(itemFor('Jellyfin')).not.toHaveTextContent('Add a Shows library');
  });

  test("says when a server couldn't be checked", () => {
    render(<LibraryCheckNotes
      folder={tvFolder([report({ serverType: 'emby', status: 'unreachable', libraries: [], issues: [{ code: 'unreachable', message: "Couldn't read Emby's libraries: connect ECONNREFUSED" }] })])}
      servers={SERVERS}
    />);

    expect(itemFor('Emby')).toHaveTextContent("couldn't be checked");
  });

  test('can leave out servers where all is well', () => {
    render(<LibraryCheckNotes
      folder={tvFolder([report({}), report({ serverType: 'jellyfin', status: 'missing', libraries: [] })])}
      servers={SERVERS}
      problemsOnly
    />);

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText('Plex:')).not.toBeInTheDocument();
  });

  test('renders nothing when every server is fine and only problems are wanted', () => {
    const { container } = render(<LibraryCheckNotes folder={tvFolder([report({})])} servers={SERVERS} problemsOnly />);

    expect(container).toBeEmptyDOMElement();
  });

  test('maps the folder for Plex refreshes from a missing mapping', async () => {
    const user = userEvent.setup();
    const onApplyPlexMapping = jest.fn().mockResolvedValue(undefined);
    render(<LibraryCheckNotes
      folder={tvFolder([report({ status: 'warning', issues: [{ code: 'plexMappingMissing', message: "New episodes don't refresh YouTube TV.", libraryId: '41' }] })])}
      servers={SERVERS}
      onApplyPlexMapping={onApplyPlexMapping}
    />);

    await user.click(screen.getByRole('button', { name: 'Refresh this library' }));

    expect(onApplyPlexMapping).toHaveBeenCalledWith('TV', '41');
  });

  test("shows the server's refusal when the mapping fails", async () => {
    const user = userEvent.setup();
    const onApplyPlexMapping = jest.fn().mockRejectedValue(new Error('__TV already refreshes another Plex library.'));
    render(<LibraryCheckNotes
      folder={tvFolder([report({ status: 'warning', issues: [{ code: 'plexMappingMissing', message: 'Not refreshed.', libraryId: '41' }] })])}
      servers={SERVERS}
      onApplyPlexMapping={onApplyPlexMapping}
    />);

    await user.click(screen.getByRole('button', { name: 'Refresh this library' }));

    expect(await screen.findByText('__TV already refreshes another Plex library.')).toBeInTheDocument();
  });
});
