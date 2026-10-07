import React from 'react';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test-utils';
import { SETTINGS_PAGES, SettingsIndex } from '../SettingsIndex';
import { useLibraryFolders } from '../../../hooks/useLibraryFolders';
import { useContainerWidth } from '../../../hooks/useContainerWidth';

jest.mock('../../../hooks/useLibraryFolders', () => ({ useLibraryFolders: jest.fn() }));
jest.mock('../../../hooks/useContainerWidth', () => ({ useContainerWidth: jest.fn() }));

const f = (name: string, layout = 'videos') => ({ name, layout, isDefault: false, hasFiles: false, channels: 0 });
const loadedState = (folders: ReturnType<typeof f>[]) => ({ folders, loading: false, loaded: true, error: null });

const HEADINGS = ['Downloads & library', 'Media servers', 'Automation & storage', 'System', 'Setting up your library'];

function headingOrder(): string[] {
  return screen
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent ?? '')
    .filter((text) => HEADINGS.includes(text));
}

describe('SettingsIndex', () => {
  beforeEach(() => {
    (useContainerWidth as jest.Mock).mockReturnValue([jest.fn(), 900]);
    (useLibraryFolders as jest.Mock).mockReturnValue(loadedState([]));
  });

  test('groups pages, keeping their order inside each group', () => {
    renderWithProviders(<SettingsIndex token="t" />);
    const downloads = screen.getByRole('region', { name: 'Downloads & library' });
    expect(within(downloads).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/settings/core', '/settings/library', '/settings/downloading', '/settings/cookies', '/settings/sponsorblock', '/settings/youtube-api',
    ]);
  });

  test('every page belongs to a group', () => {
    expect(SETTINGS_PAGES.every((page) => ['downloads', 'servers', 'automation', 'system'].includes(page.group))).toBe(true);
  });

  test('the Library folders row counts folders by layout', () => {
    (useLibraryFolders as jest.Mock).mockReturnValue(loadedState([f(''), f('Kids'), f('TV', 'tv')]));
    renderWithProviders(<SettingsIndex token="t" />);
    expect(screen.getByText('3 folders')).toBeInTheDocument();
    expect(screen.getByText('2 Videos folders')).toBeInTheDocument();
    expect(screen.getByText('1 TV folder')).toBeInTheDocument();
  });

  test('main folder only', () => {
    (useLibraryFolders as jest.Mock).mockReturnValue(loadedState([f('')]));
    renderWithProviders(<SettingsIndex token="t" />);
    expect(screen.getByText('Main folder only')).toBeInTheDocument();
  });

  test('the Library folders row shows no counts before the folders have loaded', () => {
    (useLibraryFolders as jest.Mock).mockReturnValue({ folders: [], loading: false, loaded: false, error: null });
    renderWithProviders(<SettingsIndex token="t" />);
    expect(screen.queryByText(/^\d+ (Videos |TV )?folders?$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Main folder only')).not.toBeInTheDocument();
  });

  test('puts the groups in two columns at 720px and wider', () => {
    renderWithProviders(<SettingsIndex token="t" />);
    expect(headingOrder()).toEqual(['Downloads & library', 'Automation & storage', 'Media servers', 'System', 'Setting up your library']);
  });

  test('stacks the groups in one column below 720px', () => {
    (useContainerWidth as jest.Mock).mockReturnValue([jest.fn(), 600]);
    renderWithProviders(<SettingsIndex token="t" />);
    expect(headingOrder()).toEqual(['Downloads & library', 'Media servers', 'Automation & storage', 'System', 'Setting up your library']);
  });

  test('the help card links to the Library folders page with a phone-sized target', () => {
    renderWithProviders(<SettingsIndex token="t" />);
    const link = screen.getByRole('link', { name: /Open Library folders/ });
    expect(link).toHaveAttribute('href', '/settings/library');
    expect(link).toHaveClass('max-md:min-h-[44px]');
  });
});
