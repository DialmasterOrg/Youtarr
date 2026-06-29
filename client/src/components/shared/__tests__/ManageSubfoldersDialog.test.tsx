import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManageSubfoldersDialog } from '../ManageSubfoldersDialog';

const mockDelete = jest.fn();
jest.mock('../../../hooks/useSubfolders', () => ({
  useSubfolders: () => ({
    subfolders: [],
    loading: false,
    error: null,
    refetch: jest.fn(),
    createSubfolder: jest.fn(),
    deleteSubfolder: mockDelete,
  }),
}));

let mockItems: Array<{
  name: string;
  displayName: string;
  usage: { channels: number; playlists: number; isDefault: boolean; plexMapped: boolean; hasFiles: boolean };
  deletable: boolean;
}>;
jest.mock('../../../hooks/useSubfolderUsage', () => ({
  useSubfolderUsage: () => ({ items: mockItems, loading: false, error: null, refetch: jest.fn() }),
}));

const usage = (over = {}) => ({
  channels: 0, playlists: 0, isDefault: false, plexMapped: false, hasFiles: false, ...over,
});

describe('ManageSubfoldersDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockItems = [
      { name: 'Spare', displayName: '__Spare', usage: usage(), deletable: true },
      { name: 'Music', displayName: '__Music', usage: usage({ channels: 2, hasFiles: true }), deletable: false },
    ];
  });

  test('lists known subfolders', () => {
    render(<ManageSubfoldersDialog open onClose={jest.fn()} token="t" />);
    expect(screen.getByText('__Spare')).toBeInTheDocument();
    expect(screen.getByText('__Music')).toBeInTheDocument();
  });

  test('shows usage chips for an in-use subfolder', () => {
    render(<ManageSubfoldersDialog open onClose={jest.fn()} token="t" />);
    expect(screen.getByText('2 channels')).toBeInTheDocument();
    expect(screen.getByText('Has videos')).toBeInTheDocument();
  });

  test('shows Unused for a deletable subfolder', () => {
    render(<ManageSubfoldersDialog open onClose={jest.fn()} token="t" />);
    expect(screen.getByText('Unused')).toBeInTheDocument();
  });

  test('deletes a deletable subfolder by its clean name', async () => {
    mockDelete.mockResolvedValueOnce(undefined);
    render(<ManageSubfoldersDialog open onClose={jest.fn()} token="t" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete __Spare' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('Spare'));
  });

  test('disables delete for an in-use subfolder', () => {
    render(<ManageSubfoldersDialog open onClose={jest.fn()} token="t" />);
    expect(screen.getByRole('button', { name: '__Music is in use' })).toBeDisabled();
  });

  test('shows the server reason when a delete is blocked by a race', async () => {
    mockDelete.mockRejectedValueOnce(new Error('Subfolder is in use by 1 channel(s)'));
    render(<ManageSubfoldersDialog open onClose={jest.fn()} token="t" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete __Spare' }));
    expect(await screen.findByText('Subfolder is in use by 1 channel(s)')).toBeInTheDocument();
  });
});
