import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { LibraryFoldersList } from '../LibraryFoldersList';
import type { LibraryFolder } from '../../../../../types/tvShows';
import type { UseLibraryFoldersResult } from '../../../../../hooks/useLibraryFolders';

jest.mock('../../../../shared/Reorganize', () => {
  const actual = jest.requireActual('../../../../shared/Reorganize');
  return {
    ...actual,
    ReorganizeDialog: function MockReorganizeDialog(props: { open: boolean; change: unknown }) {
      const React = require('react');
      return props.open
        ? React.createElement('div', { 'data-testid': 'reorganize-dialog' }, JSON.stringify(props.change))
        : null;
    },
  };
});

const mockSetFolderLayout = jest.fn();
const mockRefetch = jest.fn();

const FOLDERS: LibraryFolder[] = [
  { name: '', layout: 'videos', isDefault: true, hasFiles: false, channels: 3 },
  { name: 'Shows', layout: 'videos', isDefault: false, hasFiles: false, channels: 1 },
  { name: 'Kids', layout: 'tv', isDefault: false, hasFiles: true, channels: 0 },
];

type User = ReturnType<typeof userEvent.setup>;

// The library folders state the section passes down (its useLibraryFolders result).
let library: UseLibraryFoldersResult;

function mockHook(overrides: Partial<UseLibraryFoldersResult> = {}) {
  library = {
    folders: FOLDERS,
    loading: false,
    error: null,
    layoutOf: () => 'videos',
    refetch: mockRefetch,
    setFolderLayout: mockSetFolderLayout,
    ...overrides,
  };
}

function rowFor(label: string): HTMLElement {
  const row = screen.getAllByRole('listitem').find((item) => within(item).queryByText(label));
  if (!row) throw new Error(`No row for ${label}`);
  return row;
}

async function chooseLayout(user: User, folderLabel: string, optionLabel: string) {
  await user.click(screen.getByRole('button', { name: `Layout for ${folderLabel}` }));
  await user.click(await screen.findByRole('option', { name: optionLabel }));
}

describe('LibraryFoldersList', () => {
  beforeEach(() => {
    mockHook();
  });

  test('renders a row for each folder with its label', () => {
    render(<LibraryFoldersList library={library} token="token" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Main folder')).toBeInTheDocument();
    expect(screen.getByText('__Shows')).toBeInTheDocument();
    expect(screen.getByText('__Kids')).toBeInTheDocument();
  });

  test('marks the default folder', () => {
    render(<LibraryFoldersList library={library} token="token" />);
    expect(within(rowFor('Main folder')).getByText('Default')).toBeInTheDocument();
  });

  test('does not mark folders that are not the default', () => {
    render(<LibraryFoldersList library={library} token="token" />);
    expect(within(rowFor('__Shows')).queryByText('Default')).not.toBeInTheDocument();
  });

  test('shows the plural channel count', () => {
    render(<LibraryFoldersList library={library} token="token" />);
    expect(within(rowFor('Main folder')).getByText('3 channels')).toBeInTheDocument();
  });

  test('shows the singular channel count', () => {
    render(<LibraryFoldersList library={library} token="token" />);
    expect(within(rowFor('__Shows')).getByText('1 channel')).toBeInTheDocument();
  });

  test('shows each folder layout as the selected value', () => {
    render(<LibraryFoldersList library={library} token="token" />);
    expect(screen.getByRole('button', { name: 'Layout for __Kids' })).toHaveTextContent('TV shows');
  });

  test('changes a subfolder layout through the hook', async () => {
    const user = userEvent.setup();
    render(<LibraryFoldersList library={library} token="token" />);

    await chooseLayout(user, '__Shows', 'TV shows');

    expect(mockSetFolderLayout).toHaveBeenCalledWith('Shows', 'tv');
  });

  test('lets a folder that holds downloaded videos change layout', () => {
    render(<LibraryFoldersList library={library} token="token" />);
    expect(screen.getByRole('button', { name: 'Layout for __Kids' })).toBeEnabled();
  });

  test('says a folder\'s downloaded videos move with a layout change', () => {
    render(<LibraryFoldersList library={library} token="token" />);
    expect(
      within(rowFor('__Kids')).getByText('Holds downloaded videos: changing its layout moves them, and you review the move first.')
    ).toBeInTheDocument();
  });

  test('opens the move review when the folder\'s files must move', async () => {
    const { ReorganizeRequiredError } = jest.requireActual('../../../../shared/Reorganize');
    mockSetFolderLayout.mockRejectedValueOnce(
      new ReorganizeRequiredError('Review the move', { type: 'folderLayout', folder: 'Shows', layout: 'tv' })
    );
    const user = userEvent.setup();
    render(<LibraryFoldersList library={library} token="token" />);

    await chooseLayout(user, '__Shows', 'TV shows');

    expect(await screen.findByTestId('reorganize-dialog')).toHaveTextContent('"folder":"Shows"');
    expect(screen.queryByText('Review the move')).not.toBeInTheDocument();
  });

  test('switching the main folder to TV asks for confirmation first', async () => {
    const user = userEvent.setup();
    render(<LibraryFoldersList library={library} token="token" />);

    await chooseLayout(user, 'Main folder', 'TV shows');

    expect(
      await screen.findByRole('dialog', { name: 'Use the main folder for TV shows?' })
    ).toBeInTheDocument();
    expect(mockSetFolderLayout).not.toHaveBeenCalled();
  });

  test('confirming the main folder dialog changes the layout', async () => {
    const user = userEvent.setup();
    render(<LibraryFoldersList library={library} token="token" />);

    await chooseLayout(user, 'Main folder', 'TV shows');
    await user.click(await screen.findByRole('button', { name: 'Use for TV shows' }));

    expect(mockSetFolderLayout).toHaveBeenCalledWith('', 'tv');
  });

  test('closes the main folder dialog once the change is done', async () => {
    const user = userEvent.setup();
    render(<LibraryFoldersList library={library} token="token" />);

    await chooseLayout(user, 'Main folder', 'TV shows');
    await user.click(await screen.findByRole('button', { name: 'Use for TV shows' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  test('cancelling the main folder dialog leaves the layout alone', async () => {
    const user = userEvent.setup();
    render(<LibraryFoldersList library={library} token="token" />);

    await chooseLayout(user, 'Main folder', 'TV shows');
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(mockSetFolderLayout).not.toHaveBeenCalled();
  });

  test('switching a TV main folder back to Videos needs no confirmation', async () => {
    const user = userEvent.setup();
    mockHook({
      folders: [{ name: '', layout: 'tv', isDefault: true, hasFiles: false, channels: 0 }],
    });
    render(<LibraryFoldersList library={library} token="token" />);

    await chooseLayout(user, 'Main folder', 'Videos');

    expect(mockSetFolderLayout).toHaveBeenCalledWith('', 'videos');
  });

  test('shows the refusal message from a failed change', async () => {
    const user = userEvent.setup();
    mockSetFolderLayout.mockRejectedValueOnce(new Error('A download is running'));
    render(<LibraryFoldersList library={library} token="token" />);

    await chooseLayout(user, '__Shows', 'TV shows');

    expect(await screen.findByRole('alert')).toHaveTextContent('A download is running');
  });

  test('dismisses the refusal message', async () => {
    const user = userEvent.setup();
    mockSetFolderLayout.mockRejectedValueOnce(new Error('A download is running'));
    render(<LibraryFoldersList library={library} token="token" />);

    await chooseLayout(user, '__Shows', 'TV shows');
    const alert = await screen.findByRole('alert');
    await user.click(within(alert).getByRole('button', { name: 'Close' }));

    expect(screen.queryByText('A download is running')).not.toBeInTheDocument();
  });

  test('clears the refusal message after the next successful change', async () => {
    const user = userEvent.setup();
    mockSetFolderLayout.mockRejectedValueOnce(new Error('A download is running'));
    render(<LibraryFoldersList library={library} token="token" />);

    await chooseLayout(user, '__Shows', 'TV shows');
    await screen.findByText('A download is running');
    await chooseLayout(user, '__Shows', 'TV shows');

    await waitFor(() => {
      expect(screen.queryByText('A download is running')).not.toBeInTheDocument();
    });
  });

  test('notes when the default folder is a TV folder', () => {
    mockHook({
      folders: [
        { name: '', layout: 'videos', isDefault: false, hasFiles: false, channels: 0 },
        { name: 'Shows', layout: 'tv', isDefault: true, hasFiles: false, channels: 2 },
      ],
    });
    render(<LibraryFoldersList library={library} token="token" />);
    expect(screen.getByText(/The default subfolder is a TV folder/)).toBeInTheDocument();
  });

  test('has no TV note when the default folder uses the Videos layout', () => {
    render(<LibraryFoldersList library={library} token="token" />);
    expect(screen.queryByText(/The default subfolder is a TV folder/)).not.toBeInTheDocument();
  });

  test('shows a loading state before the folders arrive', () => {
    mockHook({ folders: [], loading: true });
    render(<LibraryFoldersList library={library} token="token" />);
    expect(screen.getByText('Loading library folders...')).toBeInTheDocument();
  });

  test('keeps the rows visible while refetching', () => {
    mockHook({ loading: true });
    render(<LibraryFoldersList library={library} token="token" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  test('shows the load error', () => {
    mockHook({ folders: [], error: 'Failed to load library folders' });
    render(<LibraryFoldersList library={library} token="token" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load library folders');
  });

  test('retries loading from the error alert', async () => {
    const user = userEvent.setup();
    mockHook({ folders: [], error: 'Failed to load library folders' });
    render(<LibraryFoldersList library={library} token="token" />);

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(mockRefetch).toHaveBeenCalled();
  });
});
