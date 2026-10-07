import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FolderDetailScreen } from '../FolderDetailScreen';
import { folder, makePageValue, renderInPage } from '../../__tests__/renderPage';

jest.mock('../FolderInspector', () => ({ FolderInspector: () => null }));

describe('FolderDetailScreen', () => {
  test('goes back to the list', async () => {
    const onBack = jest.fn();
    renderInPage(<FolderDetailScreen folder={folder('Kids')} onBack={onBack} />, { value: makePageValue({ twoColumn: false }) });
    await userEvent.click(screen.getByRole('button', { name: 'Library folders' }));
    expect(onBack).toHaveBeenCalled();
  });
});
