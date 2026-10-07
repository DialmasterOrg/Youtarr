import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AfterwardsNote } from '../AfterwardsNote';
import { folder, makePageValue, renderInPage } from '../../__tests__/renderPage';
import { useLibraryCheck } from '../../../../hooks/useLibraryCheck';

jest.mock('../../../../hooks/useLibraryCheck', () => ({ useLibraryCheck: jest.fn() }));

describe('AfterwardsNote', () => {
  test('checks the folder as the target layout', () => {
    (useLibraryCheck as jest.Mock).mockReturnValue({ data: { servers: [], folders: [{ name: 'Kids', layout: 'tv', hasFiles: false, channels: 1, servers: [
      { serverType: 'plex', status: 'missing', libraries: [], issues: [] },
    ] }] }, loading: false, error: null });
    renderInPage(<AfterwardsNote folder={folder('Kids')} target="tv" />, { value: makePageValue({ servers: [{ serverType: 'plex', name: 'Plex' }] }) });
    expect(useLibraryCheck).toHaveBeenCalledWith('token', { folders: ['Kids'], layout: 'tv', enabled: true });
    expect(screen.getByText('Plex: needs a TV Shows library on __Kids.')).toBeInTheDocument();
  });

  test('without servers says what the libraries must become', () => {
    (useLibraryCheck as jest.Mock).mockReturnValue({ data: null, loading: false, error: null });
    renderInPage(<AfterwardsNote folder={folder('Kids')} target="tv" />);
    expect(screen.getByText('Afterwards its media server libraries must be the TV shows type.')).toBeInTheDocument();
  });

  describe('overlap issue', () => {
    const overlapCheck = () => (useLibraryCheck as jest.Mock).mockReturnValue({ data: { servers: [], folders: [{ name: 'Kids', layout: 'tv', hasFiles: false, channels: 1, servers: [
      { serverType: 'plex', status: 'issues', libraries: [], issues: [{ code: 'overlap', message: 'overlaps' }] },
    ] }] }, loading: false, error: null });
    const servers = [{ serverType: 'plex' as const, name: 'Plex' }];

    test('offers all options and opens the start dialog', async () => {
      overlapCheck();
      const value = makePageValue({ servers });
      renderInPage(<AfterwardsNote folder={folder('Kids')} target="tv" />, { value });
      await userEvent.click(screen.getByRole('button', { name: 'See all your options' }));
      expect(value.openStartTv).toHaveBeenCalled();
    });

    test('gives the options button a 44px target on phones', () => {
      overlapCheck();
      renderInPage(<AfterwardsNote folder={folder('Kids')} target="tv" />, { value: makePageValue({ servers, phone: true }) });
      expect(screen.getByRole('button', { name: 'See all your options' })).toHaveClass('min-h-[44px]');
    });
  });
});
