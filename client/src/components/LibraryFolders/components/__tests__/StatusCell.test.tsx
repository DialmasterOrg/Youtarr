import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatusCell, StatusLine } from '../StatusCell';
import type { ServerDisplay, ServerStatus } from '../../../../utils/libraryAttention';

const status = (display: ServerDisplay, word: string, extra: Partial<ServerStatus> = {}): ServerStatus => ({
  serverType: 'plex', name: 'Plex', display, word, report: null, ...extra,
});

describe('StatusCell', () => {
  test.each<[ServerDisplay, string, string]>([
    ['issues', '2 issues', 'Plex: 2 issues.'],
    ['noLibrary', 'No library', 'Plex: No library.'],
    ['unchecked', 'Not checked', 'Plex: Not checked.'],
    ['checking', 'Checking...', 'Plex: Checking...'],
  ])('shows the word and a full description for %s', (display, word, description) => {
    render(<StatusCell status={status(display, word)} />);
    expect(screen.getByText(word)).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
  });
});

describe('StatusLine', () => {
  test('lists each server with OK for a healthy one and the word otherwise', () => {
    render(<StatusLine statuses={[status('ok', 'YouTube'), status('noLibrary', 'No library', { serverType: 'jellyfin', name: 'Jellyfin' })]} />);
    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.getByText('No library')).toBeInTheDocument();
    expect(screen.getByText('Jellyfin')).toBeInTheDocument();
  });
});
