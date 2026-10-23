import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PageHeader } from '../PageHeader';
import { makePageValue, renderInPage } from '../../__tests__/renderPage';

describe('PageHeader', () => {
  test('the heading, downloads path and saves-at-once note', () => {
    renderInPage(<PageHeader />);
    expect(screen.getByRole('heading', { level: 1, name: 'Library folders' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(screen.getByText('/usr/src/app/data')).toBeInTheDocument();
    expect(screen.getByText(/set by YOUTUBE_OUTPUT_DIR/)).toBeInTheDocument();
    expect(screen.getByText(/Changes on this page save right away\./)).toBeInTheDocument();
  });

  test('no servers: no check button and a link to connect one', () => {
    renderInPage(<PageHeader />);
    expect(screen.queryByRole('button', { name: 'Check media servers' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connect one' })).toHaveAttribute('href', '/settings/plex');
  });

  test('says nothing about media servers until they are known', () => {
    renderInPage(<PageHeader />, { value: makePageValue({ serversKnown: false }) });
    expect(screen.queryByText(/No media server connected/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Connect one' })).not.toBeInTheDocument();
  });

  test('runs the check and opens Add folder with Videos', async () => {
    const value = makePageValue({ servers: [{ serverType: 'plex', name: 'Plex' }], configuredServers: ['plex'] });
    renderInPage(<PageHeader />, { value });
    await userEvent.click(screen.getByRole('button', { name: 'Check media servers' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add folder' }));
    expect(value.check.refetch).toHaveBeenCalled();
    expect(value.openAddFolder).toHaveBeenCalledWith('videos');
  });

  test('a DATA_PATH platform says so', () => {
    renderInPage(<PageHeader />, { value: makePageValue({ isPlatformManaged: { ...makePageValue().isPlatformManaged, youtubeOutputDirectory: true } }) });
    expect(screen.getByText(/set by DATA_PATH/)).toBeInTheDocument();
  });

  test('a running check disables the button and says Checking...', () => {
    const value = makePageValue({
      servers: [{ serverType: 'plex', name: 'Plex' }], configuredServers: ['plex'],
      check: { ...makePageValue().check, loading: true },
    });
    renderInPage(<PageHeader />, { value });
    expect(screen.getByRole('button', { name: 'Checking...' })).toBeDisabled();
  });

  test('phone: the downloads line and a full-width Add folder', () => {
    renderInPage(<PageHeader />, { value: makePageValue({ phone: true }) });
    expect(screen.getByText(/downloads folder, set by YOUTUBE_OUTPUT_DIR/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add folder' })).toHaveClass('min-h-[44px]');
  });
});
