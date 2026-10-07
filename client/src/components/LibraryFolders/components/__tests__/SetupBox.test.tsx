import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetupBox } from '../SetupBox';
import { makePageValue, renderInPage } from '../../__tests__/renderPage';

describe('SetupBox', () => {
  test('lists the rows, copies a real path and re-checks', async () => {
    const value = makePageValue();
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
    renderInPage(<SetupBox server="plex" layout="tv" path={{ text: 'Q:\\Y\\__TV', copyable: true }} />, { value });

    expect(screen.getByText('Create it in Plex')).toBeInTheDocument();
    expect(screen.getByText('Plex NFO Series or Personal Media')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copy path' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Q:\\Y\\__TV');
    expect(value.notify).toHaveBeenCalledWith('Copied');
    await userEvent.click(screen.getByRole('button', { name: 'I added it, check again' }));
    expect(value.check.refetch).toHaveBeenCalled();
  });

  test('describes an unknown path without a copy button', () => {
    renderInPage(<SetupBox server="emby" layout="videos" path={{ text: '__Kids in your downloads folder, as Emby sees it', copyable: false }} />);
    expect(screen.queryByRole('button', { name: 'Copy path' })).not.toBeInTheDocument();
  });
});
