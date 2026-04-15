import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { PlexSubfolderMappings, PlexSubfolderMapping } from '../PlexSubfolderMappings';
import { renderWithProviders } from '../../../../test-utils';
import { PlexConnectionStatus } from '../../types';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

const axios = require('axios');

const MOCK_LIBRARIES = [
  { id: '1', title: 'YouTube' },
  { id: '2', title: 'Kids Shows' },
];

const MOCK_SUBFOLDERS = ['__kids', '__music'];

function setupAxiosMocks() {
  axios.get.mockResolvedValue({ data: MOCK_SUBFOLDERS });
}

const DEFAULT_PROPS = {
  mappings: [] as PlexSubfolderMapping[],
  onMappingsChange: jest.fn(),
  token: 'test-token',
  plexConnectionStatus: 'connected' as PlexConnectionStatus,
  plexLibraries: MOCK_LIBRARIES,
};

describe('PlexSubfolderMappings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when plexConnectionStatus is not connected', () => {
    test('renders nothing when status is not_tested and no mappings exist', () => {
      renderWithProviders(
        <PlexSubfolderMappings {...DEFAULT_PROPS} plexConnectionStatus="not_tested" />
      );
      expect(screen.queryByText('Per-Subfolder Library Mappings')).not.toBeInTheDocument();
    });

    test('renders nothing when status is not_connected and no mappings exist', () => {
      renderWithProviders(
        <PlexSubfolderMappings {...DEFAULT_PROPS} plexConnectionStatus="not_connected" />
      );
      expect(screen.queryByText('Per-Subfolder Library Mappings')).not.toBeInTheDocument();
    });

    test('shows existing mappings with delete buttons when disconnected', () => {
      renderWithProviders(
        <PlexSubfolderMappings
          {...DEFAULT_PROPS}
          plexConnectionStatus="not_connected"
          mappings={[{ subfolder: 'kids', libraryId: '2' }]}
        />
      );
      expect(screen.getByText('Per-Subfolder Library Mappings')).toBeInTheDocument();
      expect(screen.getByText('__kids')).toBeInTheDocument();
      expect(screen.getByTestId('delete-mapping-kids')).toBeInTheDocument();
    });

    test('shows "Library ID:" fallback for library title when disconnected and libraries are empty', () => {
      renderWithProviders(
        <PlexSubfolderMappings
          {...DEFAULT_PROPS}
          plexConnectionStatus="not_connected"
          plexLibraries={[]}
          mappings={[{ subfolder: 'kids', libraryId: '2' }]}
        />
      );
      expect(screen.getByText('Library ID: 2')).toBeInTheDocument();
      // No duplicated "(id: 2)" when id is already the primary display
      expect(screen.queryByText('(id: 2)')).not.toBeInTheDocument();
    });

    test('still shows the resolved library title when disconnected if libraries prop was populated earlier', () => {
      renderWithProviders(
        <PlexSubfolderMappings
          {...DEFAULT_PROPS}
          plexConnectionStatus="not_connected"
          mappings={[{ subfolder: 'kids', libraryId: '2' }]}
        />
      );
      expect(screen.getByText('Kids Shows')).toBeInTheDocument();
      expect(screen.getByText('(id: 2)')).toBeInTheDocument();
    });

    test('Add Mapping button is disabled when disconnected with existing mappings', () => {
      renderWithProviders(
        <PlexSubfolderMappings
          {...DEFAULT_PROPS}
          plexConnectionStatus="not_connected"
          mappings={[{ subfolder: 'kids', libraryId: '2' }]}
        />
      );
      expect(screen.getByTestId('add-mapping-button')).toBeDisabled();
    });
  });

  describe('when plexConnectionStatus is connected', () => {
    beforeEach(() => {
      setupAxiosMocks();
    });

    test('shows the section title "Per-Subfolder Library Mappings"', async () => {
      renderWithProviders(<PlexSubfolderMappings {...DEFAULT_PROPS} />);
      await waitFor(() => {
        expect(screen.getByText('Per-Subfolder Library Mappings')).toBeInTheDocument();
      });
    });

    test('shows "No per-subfolder mappings configured" when mappings array is empty', async () => {
      renderWithProviders(<PlexSubfolderMappings {...DEFAULT_PROPS} />);
      await waitFor(() => {
        expect(
          screen.getByText(/No per-subfolder mappings configured/)
        ).toBeInTheDocument();
      });
    });

    test('shows the "Add Mapping" button', async () => {
      renderWithProviders(<PlexSubfolderMappings {...DEFAULT_PROPS} />);
      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-button')).toBeInTheDocument();
      });
    });

    test('does NOT call axios when not connected', () => {
      axios.get.mockReset();
      renderWithProviders(
        <PlexSubfolderMappings {...DEFAULT_PROPS} plexConnectionStatus="not_connected" />
      );
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe('loading and error states', () => {
    test('shows loading indicator while the subfolder fetch is in progress', () => {
      axios.get.mockReturnValue(new Promise(() => {}));
      renderWithProviders(<PlexSubfolderMappings {...DEFAULT_PROPS} />);
      expect(screen.getByText(/Loading subfolders/)).toBeInTheDocument();
    });

    test('shows error alert when the subfolder fetch fails', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));
      renderWithProviders(<PlexSubfolderMappings {...DEFAULT_PROPS} />);
      await waitFor(() => {
        expect(
          screen.getByText(/Could not load channel subfolders/)
        ).toBeInTheDocument();
      });
    });

    test('still shows mapping rows with resolved library titles when the subfolder fetch fails', async () => {
      axios.get.mockRejectedValue(new Error('Subfolders failed'));
      renderWithProviders(
        <PlexSubfolderMappings
          {...DEFAULT_PROPS}
          mappings={[{ subfolder: 'kids', libraryId: '2' }]}
        />
      );
      await waitFor(() => {
        expect(
          screen.getByText(/Could not load channel subfolders/)
        ).toBeInTheDocument();
      });
      expect(screen.getByText('Kids Shows')).toBeInTheDocument();
      expect(screen.getByText('(id: 2)')).toBeInTheDocument();
    });
  });

  describe('existing mappings display', () => {
    test('renders a table row for each mapping showing subfolder name with __ prefix', async () => {
      setupAxiosMocks();
      renderWithProviders(
        <PlexSubfolderMappings
          {...DEFAULT_PROPS}
          mappings={[{ subfolder: 'kids', libraryId: '2' }]}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('__kids')).toBeInTheDocument();
      });
    });

    test('renders "Root folder" label for a mapping with subfolder: null', async () => {
      setupAxiosMocks();
      renderWithProviders(
        <PlexSubfolderMappings
          {...DEFAULT_PROPS}
          mappings={[{ subfolder: null, libraryId: '1' }]}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Root folder')).toBeInTheDocument();
      });
    });

    test('renders the library title with an "(id: X)" suffix for resolved libraries', async () => {
      setupAxiosMocks();
      renderWithProviders(
        <PlexSubfolderMappings
          {...DEFAULT_PROPS}
          mappings={[{ subfolder: 'kids', libraryId: '2' }]}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Kids Shows')).toBeInTheDocument();
      });
      expect(screen.getByText('(id: 2)')).toBeInTheDocument();
    });
  });

  describe('adding a mapping', () => {
    beforeEach(() => {
      setupAxiosMocks();
    });

    test('clicking "Add Mapping" shows the subfolder and library selects', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PlexSubfolderMappings {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-button')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('add-mapping-button'));

      expect(screen.getByRole('button', { name: 'Subfolder' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Plex Library' })).toBeInTheDocument();
    });

    test('clicking "Cancel" hides the form', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PlexSubfolderMappings {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-button')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('add-mapping-button'));
      expect(screen.getByRole('button', { name: 'Subfolder' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('button', { name: 'Subfolder' })).not.toBeInTheDocument();
    });

    test('"Add" button is disabled when no subfolder is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PlexSubfolderMappings {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-button')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('add-mapping-button'));

      expect(screen.getByTestId('confirm-add-mapping-button')).toBeDisabled();
    });

    test('"Add" button is disabled when no library is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PlexSubfolderMappings {...DEFAULT_PROPS} />);

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-button')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.queryByText(/Loading subfolders/)).not.toBeInTheDocument();
      });

      await user.click(screen.getByTestId('add-mapping-button'));

      await user.click(screen.getByRole('button', { name: 'Subfolder' }));
      await user.click(screen.getByRole('option', { name: '__kids' }));

      expect(screen.getByTestId('confirm-add-mapping-button')).toBeDisabled();
    });

    test('"Add" button is disabled when the selected subfolder is already mapped (duplicate)', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <PlexSubfolderMappings
          {...DEFAULT_PROPS}
          mappings={[{ subfolder: 'kids', libraryId: '1' }]}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-button')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.queryByText(/Loading subfolders/)).not.toBeInTheDocument();
      });

      await user.click(screen.getByTestId('add-mapping-button'));

      await user.click(screen.getByRole('button', { name: 'Subfolder' }));

      const kidsOption = screen.getByRole('option', { name: '__kids' });
      expect(kidsOption).toHaveAttribute('data-disabled');
    });

    test('selecting a subfolder and library and clicking "Add" calls onMappingsChange with the new mapping appended', async () => {
      const user = userEvent.setup();
      const onMappingsChange = jest.fn();
      renderWithProviders(
        <PlexSubfolderMappings {...DEFAULT_PROPS} onMappingsChange={onMappingsChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-button')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.queryByText(/Loading subfolders/)).not.toBeInTheDocument();
      });

      await user.click(screen.getByTestId('add-mapping-button'));

      await user.click(screen.getByRole('button', { name: 'Subfolder' }));
      await user.click(screen.getByRole('option', { name: '__kids' }));

      await user.click(screen.getByRole('button', { name: 'Plex Library' }));
      await user.click(screen.getByRole('option', { name: 'YouTube' }));

      await user.click(screen.getByTestId('confirm-add-mapping-button'));

      expect(onMappingsChange).toHaveBeenCalledWith([{ subfolder: 'kids', libraryId: '1' }]);
    });

    test('adding a root-folder mapping stores subfolder: null', async () => {
      const user = userEvent.setup();
      const onMappingsChange = jest.fn();
      renderWithProviders(
        <PlexSubfolderMappings {...DEFAULT_PROPS} onMappingsChange={onMappingsChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-button')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.queryByText(/Loading subfolders/)).not.toBeInTheDocument();
      });

      await user.click(screen.getByTestId('add-mapping-button'));

      await user.click(screen.getByRole('button', { name: 'Subfolder' }));
      await user.click(screen.getByRole('option', { name: 'Root folder' }));

      await user.click(screen.getByRole('button', { name: 'Plex Library' }));
      await user.click(screen.getByRole('option', { name: 'YouTube' }));

      await user.click(screen.getByTestId('confirm-add-mapping-button'));

      expect(onMappingsChange).toHaveBeenCalledWith([{ subfolder: null, libraryId: '1' }]);
    });

    test('the stored subfolder value has no __ prefix', async () => {
      const user = userEvent.setup();
      const onMappingsChange = jest.fn();
      renderWithProviders(
        <PlexSubfolderMappings {...DEFAULT_PROPS} onMappingsChange={onMappingsChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('add-mapping-button')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.queryByText(/Loading subfolders/)).not.toBeInTheDocument();
      });

      await user.click(screen.getByTestId('add-mapping-button'));

      await user.click(screen.getByRole('button', { name: 'Subfolder' }));
      await user.click(screen.getByRole('option', { name: '__music' }));

      await user.click(screen.getByRole('button', { name: 'Plex Library' }));
      await user.click(screen.getByRole('option', { name: 'Kids Shows' }));

      await user.click(screen.getByTestId('confirm-add-mapping-button'));

      const calledWith = onMappingsChange.mock.calls[0][0] as PlexSubfolderMapping[];
      expect(calledWith[0].subfolder).toBe('music');
    });
  });

  describe('deleting a mapping', () => {
    beforeEach(() => {
      setupAxiosMocks();
    });

    test('clicking the delete button for a mapping calls onMappingsChange with that mapping removed', async () => {
      const user = userEvent.setup();
      const onMappingsChange = jest.fn();
      const mappings: PlexSubfolderMapping[] = [
        { subfolder: 'kids', libraryId: '2' },
        { subfolder: 'music', libraryId: '1' },
      ];
      renderWithProviders(
        <PlexSubfolderMappings
          {...DEFAULT_PROPS}
          mappings={mappings}
          onMappingsChange={onMappingsChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('delete-mapping-kids')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('delete-mapping-kids'));

      expect(onMappingsChange).toHaveBeenCalledWith([{ subfolder: 'music', libraryId: '1' }]);
    });

    test('the delete button data-testid is delete-mapping-kids for subfolder kids', async () => {
      renderWithProviders(
        <PlexSubfolderMappings
          {...DEFAULT_PROPS}
          mappings={[{ subfolder: 'kids', libraryId: '2' }]}
        />
      );
      await waitFor(() => {
        expect(screen.getByTestId('delete-mapping-kids')).toBeInTheDocument();
      });
    });

    test('the delete button data-testid is delete-mapping-root for null subfolder', async () => {
      renderWithProviders(
        <PlexSubfolderMappings
          {...DEFAULT_PROPS}
          mappings={[{ subfolder: null, libraryId: '1' }]}
        />
      );
      await waitFor(() => {
        expect(screen.getByTestId('delete-mapping-root')).toBeInTheDocument();
      });
    });
  });
});
