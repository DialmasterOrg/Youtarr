import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoTvFoldersRow } from '../NoTvFoldersRow';
import { makePageValue, renderInPage } from '../../__tests__/renderPage';

describe('NoTvFoldersRow', () => {
  test('offers the panel and a TV folder', async () => {
    const value = makePageValue();
    renderInPage(<NoTvFoldersRow />, { value });
    await userEvent.click(screen.getByRole('button', { name: 'Start using TV shows' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add TV folder' }));
    expect(value.openStartTv).toHaveBeenCalled();
    expect(value.openAddFolder).toHaveBeenCalledWith('tv');
  });
});
