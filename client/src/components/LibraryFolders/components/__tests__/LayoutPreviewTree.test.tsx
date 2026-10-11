import React from 'react';
import { screen } from '@testing-library/react';
import { LayoutPreviewTree } from '../LayoutPreviewTree';
import { folder, makePageValue, renderInPage } from '../../__tests__/renderPage';

describe('LayoutPreviewTree', () => {
  test('labels the tree as an example and links the template for Videos', () => {
    renderInPage(<LayoutPreviewTree folder={folder('Kids')} layout="videos" previewing={false} example={null} />);
    expect(screen.getByText('Example structure, with Channel Name')).toBeInTheDocument();
    expect(screen.getByText(/Example structure\. Review the move for exact file names\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Filename template: Settings > Core' })).toHaveAttribute('href', '/settings/core#naming');
  });

  test('gives the template link a 44px target on phones', () => {
    renderInPage(<LayoutPreviewTree folder={folder('Kids')} layout="videos" previewing={false} example={null} />, { value: makePageValue({ phone: true }) });
    expect(screen.getByRole('link', { name: 'Filename template: Settings > Core' })).toHaveClass('inline-flex', 'min-h-[44px]', 'items-center');
  });

  test('long file names scroll inside the tree instead of widening the panel', () => {
    renderInPage(<LayoutPreviewTree folder={folder('Kids')} layout="videos" previewing={false} example={null} />);
    expect(screen.getByRole('list', { name: 'Example file structure' })).toHaveClass('overflow-x-auto');
  });

  test('a TV folder\'s real episode reads as the show it is filed under', () => {
    renderInPage(<LayoutPreviewTree folder={folder('TV', { layout: 'tv' })} layout="tv" previewing={false} example={{
      channelName: 'Grian', title: 'Diamond Prank', youtubeId: 'abcDEF12345', uploadedAt: '2026-08-24T16:00:00.000Z',
      uploadedAtSource: 'timestamp', relativePath: 'Hermitcraft/Season 11/S11E25 - Diamond Prank [abcDEF12345].mp4',
    }} />);
    expect(screen.getByText('Shows up as the show Hermitcraft, Season 11, episode 25.')).toBeInTheDocument();
  });

  test('mentions a custom template when previewing Videos', () => {
    const value = makePageValue({ config: { ...makePageValue().config, videoFilenamePrefix: '%(title)s' } });
    renderInPage(<LayoutPreviewTree folder={folder('TV', { layout: 'tv' })} layout="videos" previewing example={null} />, { value });
    expect(screen.getByText(/Your filename template decides the real names\./)).toBeInTheDocument();
  });
});
