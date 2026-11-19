import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteFolderDialog } from '../dialogs/DeleteFolderDialog';
import { folder, renderInPage } from '../../__tests__/renderPage';
import { useSubfolders } from '../../../../hooks/useSubfolders';

jest.mock('../../../../hooks/useSubfolders', () => ({ useSubfolders: jest.fn(), SUBFOLDERS_UPDATED_EVENT: 'subfolders-updated' }));

describe('DeleteFolderDialog', () => {
  test('deletes and reports back', async () => {
    const deleteSubfolder = jest.fn().mockResolvedValue(undefined);
    (useSubfolders as jest.Mock).mockReturnValue({ deleteSubfolder });
    const onDeleted = jest.fn();
    const target = folder('Empty', { plexMapping: { choice: 'library', libraryId: '3' } });
    renderInPage(<DeleteFolderDialog folder={target} onClose={jest.fn()} onDeleted={onDeleted} />);
    expect(screen.getByText(/Its Plex refresh setting is removed too\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete folder' }));
    expect(deleteSubfolder).toHaveBeenCalledWith('Empty');
    expect(onDeleted).toHaveBeenCalledWith(target);
  });

  test('a refusal stays in the dialog and disables confirm', async () => {
    (useSubfolders as jest.Mock).mockReturnValue({ deleteSubfolder: jest.fn().mockRejectedValue(new Error('Subfolder is in use by 1 channel(s)')) });
    renderInPage(<DeleteFolderDialog folder={folder('Empty')} onClose={jest.fn()} onDeleted={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete folder' }));
    expect(await screen.findByText('Subfolder is in use by 1 channel(s)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete folder' })).toBeDisabled();
  });
});
