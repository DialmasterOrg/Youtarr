import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnusedFolderRow } from '../UnusedFolderRow';
import { folder, makePageValue, renderInPage } from '../../__tests__/renderPage';

describe('UnusedFolderRow', () => {
  test('deletes a deletable folder', async () => {
    const value = makePageValue();
    const empty = folder('Empty');
    renderInPage(<UnusedFolderRow folder={empty} selected={false} onSelect={jest.fn()} />, { value });
    await userEvent.click(screen.getByRole('button', { name: 'Delete __Empty' }));
    expect(value.openDelete).toHaveBeenCalledWith(empty);
  });

  test('explains why a folder can\'t be deleted', () => {
    renderInPage(<UnusedFolderRow
      folder={folder('Old', { deletable: false, deleteBlockers: [{ code: 'disabledChannels', count: 1 }] })}
      selected={false}
      onSelect={jest.fn()}
    />);
    const button = screen.getByRole('button', { name: 'Delete __Old' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('1 unsubscribed channel still points here');
  });

  test('sets aria-controls only when the inspector is a second column', () => {
    renderInPage(<UnusedFolderRow folder={folder('A')} selected={false} onSelect={jest.fn()} />, { value: makePageValue({ twoColumn: false }) });
    expect(screen.getByRole('button', { name: /^__A/ })).not.toHaveAttribute('aria-controls');
  });

  test('a selected row takes the link color on its icon', () => {
    renderInPage(<UnusedFolderRow folder={folder('A')} selected onSelect={jest.fn()} />);
    expect(within(screen.getByRole('button', { name: /^__A/ })).getByTestId('unused-folder-icon')).toHaveClass('text-primary');
  });

  test('on phones the delete button is icon-only with an 18px icon and a 44px target', () => {
    renderInPage(<UnusedFolderRow folder={folder('A')} selected={false} onSelect={jest.fn()} />, { value: makePageValue({ phone: true }) });
    const button = screen.getByRole('button', { name: 'Delete __A' });
    expect(button).toHaveClass('h-11', 'w-11');
    expect(within(button).getByTestId('delete-icon')).toHaveAttribute('width', '18');
    expect(within(button).getByTestId('delete-icon')).toHaveClass('!h-[18px]');
  });
});
