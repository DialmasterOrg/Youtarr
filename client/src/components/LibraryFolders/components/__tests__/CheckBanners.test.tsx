import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckBanners } from '../CheckBanners';
import { makePageValue, renderInPage } from '../../__tests__/renderPage';

describe('CheckBanners', () => {
  test('one banner per unreachable server, with Check again', async () => {
    const value = makePageValue({ check: { ...makePageValue().check, data: {
      servers: [{ serverType: 'jellyfin', name: 'Jellyfin', reachable: false, error: 'connect ECONNREFUSED' }], folders: [],
    } } });
    renderInPage(<CheckBanners missingName={null} onDismissMissing={jest.fn()} />, { value });
    expect(screen.getByText("Jellyfin couldn't be reached, so its libraries weren't checked: connect ECONNREFUSED")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jellyfin settings' })).toHaveAttribute('href', '/settings/jellyfin');
    await userEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(value.check.refetch).toHaveBeenCalled();
  });

  test('a failed check and a missing folder', async () => {
    const onDismiss = jest.fn();
    renderInPage(<CheckBanners missingName="Gone" onDismissMissing={onDismiss} />, { value: makePageValue({
      check: { ...makePageValue().check, error: 'boom' },
    }) });
    expect(screen.getByText("Couldn't check the media server libraries: boom")).toBeInTheDocument();
    expect(screen.getByText("Library folder __Gone wasn't found. It may have been deleted.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  test('phone: the banner buttons and links are 44px targets', () => {
    const value = makePageValue({ phone: true, check: { ...makePageValue().check, data: {
      servers: [{ serverType: 'plex', name: 'Plex', reachable: false, error: 'timeout' }], folders: [],
    } } });
    renderInPage(<CheckBanners missingName={null} onDismissMissing={jest.fn()} />, { value });
    expect(screen.getByRole('button', { name: 'Check again' })).toHaveClass('min-h-[44px]');
    expect(screen.getByRole('link', { name: 'Plex settings' })).toHaveClass('inline-flex', 'min-h-[44px]');
  });

  test('nothing to report renders no banner', () => {
    renderInPage(<CheckBanners missingName={null} onDismissMissing={jest.fn()} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
