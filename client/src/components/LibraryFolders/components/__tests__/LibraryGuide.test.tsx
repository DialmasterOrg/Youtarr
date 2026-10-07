import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryGuide } from '../LibraryGuide';
import { inPage, makePageValue, renderInPage } from '../../__tests__/renderPage';

describe('LibraryGuide', () => {
  beforeEach(() => window.localStorage.clear());

  test('is open without TV folders and toggles', async () => {
    renderInPage(<LibraryGuide />);
    const toggle = screen.getByRole('button', { name: 'Hide the guide' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Channels pick a folder')).toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Show the guide' })).toHaveAttribute('aria-expanded', 'false');
  });

  test('is collapsed once a TV folder exists, with the one-line summary', () => {
    renderInPage(<LibraryGuide />, { value: makePageValue({ guideDefaultOpen: false }) });
    expect(screen.getByText('Channels pick a folder, its layout files them, a matching library shows it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show the guide' })).toBeInTheDocument();
  });

  test('stays folded while the folders load, then opens when there are no TV folders', () => {
    const { rerender } = renderInPage(<LibraryGuide />, { value: makePageValue({ guideDefaultOpen: null }) });
    expect(screen.getByRole('button', { name: 'Show the guide' })).toBeInTheDocument();
    rerender(inPage(<LibraryGuide />, makePageValue({ guideDefaultOpen: true })));
    expect(screen.getByRole('button', { name: 'Hide the guide' })).toBeInTheDocument();
  });

  test('keeps its first default when the page value changes later', () => {
    const { rerender } = renderInPage(<LibraryGuide />);
    rerender(inPage(<LibraryGuide />, makePageValue({ guideDefaultOpen: false })));
    expect(screen.getByRole('button', { name: 'Hide the guide' })).toBeInTheDocument();
  });

  test('lists the connected servers\' library types', () => {
    renderInPage(<LibraryGuide />, { value: makePageValue({ servers: [{ serverType: 'jellyfin', name: 'Jellyfin' }] }) });
    expect(screen.getAllByText('Jellyfin')).toHaveLength(2);
    expect(screen.getByText('Shows')).toBeInTheDocument();
  });

  test('Start using TV shows opens the panel', async () => {
    const value = makePageValue();
    renderInPage(<LibraryGuide />, { value });
    await userEvent.click(screen.getByRole('button', { name: 'Start using TV shows' }));
    expect(value.openStartTv).toHaveBeenCalled();
  });
});
