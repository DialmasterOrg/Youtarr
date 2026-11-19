import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LayoutSection } from '../LayoutSection';
import { folder, makePageValue, renderInPage } from '../../__tests__/renderPage';

jest.mock('../AfterwardsNote', () => ({ AfterwardsNote: () => {
  const React = require('react');
  return React.createElement('p', null, 'afterwards note');
} }));

describe('LayoutSection', () => {
  test('starts as one line saying how the folder shows up', () => {
    renderInPage(<LayoutSection folder={folder('Kids', { channels: 1 })} detail={null} />);
    expect(screen.getByText('Shows up as one movie per video, titled "Video Title".')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  test('the layout line reads as one sentence, so it wraps without a stray separator', () => {
    renderInPage(<LayoutSection folder={folder('Kids', { channels: 1 })} detail={null} />);
    expect(screen.getByText((_, element) => element?.tagName === 'P'
      && element.textContent === "Videos \u00b7 each video a movie in its channel's folder")).toBeInTheDocument();
  });

  test('Change... previews the other layout with its afterwards note', async () => {
    renderInPage(<LayoutSection folder={folder('Kids', { channels: 1, layoutChangeNeedsReview: true })} detail={null} />);
    await userEvent.click(screen.getByRole('button', { name: 'Change...' }));
    expect(screen.getByRole('radio', { name: /TV shows/ })).toBeChecked();
    expect(screen.getByText(/\(preview, not applied\)/)).toBeInTheDocument();
    expect(screen.getByText('afterwards note')).toBeInTheDocument();
  });

  test('Cancel closes the preview without saving', async () => {
    const value = makePageValue();
    renderInPage(<LayoutSection folder={folder('Kids', { channels: 1, layoutChangeNeedsReview: true })} detail={null} />, { value });
    await userEvent.click(screen.getByRole('button', { name: 'Change...' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(value.changeLayout).not.toHaveBeenCalled();
  });

  test('a folder that switches at once', async () => {
    const value = makePageValue();
    renderInPage(<LayoutSection folder={folder('Kids', { channels: 1 })} detail={null} />, { value });
    await userEvent.click(screen.getByRole('button', { name: 'Change...' }));
    expect(screen.getByText('Nothing needs to move, so it switches at once.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Use for TV shows' }));
    expect(value.changeLayout).toHaveBeenCalledWith('Kids', 'tv');
  });

  test('the main folder to TV opens the confirm and warns about Jellyfin and Emby', async () => {
    const value = makePageValue();
    renderInPage(<LayoutSection folder={folder('', { isDefault: true })} detail={null} />, { value });
    await userEvent.click(screen.getByRole('button', { name: 'Change...' }));
    expect(screen.getByText(/Jellyfin and Emby can't skip them/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Use for TV shows' }));
    expect(value.openMainFolderTv).toHaveBeenCalled();
  });

  test('a title show blocks switching a TV folder to Videos', async () => {
    renderInPage(<LayoutSection folder={folder('TV', { layout: 'tv', titleShows: 1 })} detail={{
      name: 'TV', layout: 'tv', channels: [], followers: { count: 0, sample: [] }, playlists: [], example: null,
      titleShows: [{ id: 1, name: 'Lessons', channelId: 'UC1', channelName: 'Prof', episodeCount: 2 }],
    }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Change...' }));
    expect(screen.getByRole('button', { name: 'Use for Videos' })).toBeDisabled();
    expect(screen.getByText(/Lessons is a title show/)).toBeInTheDocument();
  });

  test('a running reorganize disables the change', async () => {
    renderInPage(<LayoutSection folder={folder('Kids')} detail={null} />, { value: makePageValue({ reorganizing: true }) });
    await userEvent.click(screen.getByRole('button', { name: 'Change...' }));
    expect(screen.getByRole('button', { name: 'Use for TV shows' })).toBeDisabled();
  });

  test('shows the result line for this folder without opening the preview', () => {
    renderInPage(<LayoutSection folder={folder('Kids')} detail={null} />, {
      value: makePageValue({ layoutResult: { folder: 'kids', tone: 'success', text: 'Now a TV shows folder.' } }),
    });
    expect(screen.getByText('Now a TV shows folder.')).toBeInTheDocument();
  });
});
