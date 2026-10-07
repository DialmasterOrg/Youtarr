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

  test('mentions a custom template when previewing Videos', () => {
    const value = makePageValue({ config: { ...makePageValue().config, videoFilenamePrefix: '%(title)s' } });
    renderInPage(<LayoutPreviewTree folder={folder('TV', { layout: 'tv' })} layout="videos" previewing example={null} />, { value });
    expect(screen.getByText(/Your filename template decides the real names\./)).toBeInTheDocument();
  });
});
