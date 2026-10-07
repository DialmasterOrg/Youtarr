import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteSection } from '../DeleteSection';
import { folder, makePageValue, renderInPage } from '../../__tests__/renderPage';

describe('DeleteSection', () => {
  test('the main folder can never be deleted', () => {
    renderInPage(<DeleteSection folder={folder('', { deletable: false, deleteBlockers: [{ code: 'main' }] })} />);
    const button = screen.getByRole('button', { name: 'Delete folder' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("The main folder is the downloads folder itself, so it can't be deleted.");
  });

  test('a deletable folder opens the confirm', async () => {
    const value = makePageValue();
    const empty = folder('Empty');
    renderInPage(<DeleteSection folder={empty} />, { value });
    await userEvent.click(screen.getByRole('button', { name: 'Delete folder' }));
    expect(value.openDelete).toHaveBeenCalledWith(empty);
  });
});
