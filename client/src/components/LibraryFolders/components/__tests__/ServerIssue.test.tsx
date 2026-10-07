import React from 'react';
import { screen } from '@testing-library/react';
import { ServerIssue } from '../ServerIssue';
import { folder, renderInPage } from '../../__tests__/renderPage';
import type { ServerStatus } from '../../../../utils/libraryAttention';

jest.mock('../OverlapFixBlock', () => ({ OverlapFixBlock: () => {
  const React = require('react');
  return React.createElement('div', null, 'overlap fix');
} }));

const status: ServerStatus = {
  serverType: 'jellyfin', name: 'Jellyfin', display: 'issues', word: '1 issue',
  report: { serverType: 'jellyfin', status: 'warning', libraries: [{ id: '9', name: 'YouTube', type: 'videos', location: '/yt', relation: 'exact' }], issues: [] },
};

describe('ServerIssue', () => {
  test('shows the message and the hint of a library-wide issue', () => {
    renderInPage(<ServerIssue folder={folder('Kids')} issue={{ code: 'nfoSaver', message: 'YouTube saves NFO files.', libraryId: '9' }} status={status} downloadsPath="/yt" />);
    expect(screen.getByText(/YouTube saves NFO files\./)).toBeInTheDocument();
    expect(screen.getByText('In Jellyfin: Dashboard, Libraries, YouTube, Metadata savers.')).toBeInTheDocument();
  });

  test('an overlap issue gets the fix block', () => {
    renderInPage(<ServerIssue folder={folder('TV', { layout: 'tv' })} issue={{ code: 'overlap', message: 'overlaps', libraryId: '9' }} status={status} downloadsPath="/yt" />);
    expect(screen.getByText('overlap fix')).toBeInTheDocument();
  });
});
