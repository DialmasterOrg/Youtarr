import React from 'react';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test-utils';
import { SETTINGS_GROUPS, SETTINGS_PAGES, SettingsIndex } from '../SettingsIndex';
import { useContainerWidth } from '../../../hooks/useContainerWidth';

jest.mock('../../../hooks/useContainerWidth', () => ({ useContainerWidth: jest.fn() }));

const HEADINGS = ['Downloads & library', 'Media servers', 'Automation & storage', 'Integrations', 'System'];

function headingOrder(): string[] {
  return screen
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent ?? '')
    .filter((text) => HEADINGS.includes(text));
}

function groupLinks(name: string): Array<string | null> {
  const group = screen.getByRole('region', { name });
  return within(group).getAllByRole('link').map((link) => link.getAttribute('href'));
}

describe('SettingsIndex', () => {
  beforeEach(() => {
    (useContainerWidth as jest.Mock).mockReturnValue([jest.fn(), 900]);
  });

  test('groups pages, keeping their order inside each group', () => {
    renderWithProviders(<SettingsIndex />);
    expect(groupLinks('Downloads & library')).toEqual([
      '/settings/core', '/settings/downloading', '/settings/cookies', '/settings/sponsorblock', '/settings/youtube-api',
    ]);
  });

  test('lists the tools that connect to Youtarr under Integrations', () => {
    renderWithProviders(<SettingsIndex />);
    expect(groupLinks('Integrations')).toEqual([
      '/settings/api-keys', '/settings/notifications', '/settings/rss-feeds', '/settings/sonarr-radarr',
    ]);
  });

  test('every page belongs to a group', () => {
    const groups = SETTINGS_GROUPS.map((group) => group.key);
    expect(SETTINGS_PAGES.every((page) => groups.includes(page.group))).toBe(true);
  });

  test('keeps each group\'s pages together, in group order, for the nav menus', () => {
    const pageGroups = SETTINGS_PAGES.map((page) => page.group);
    expect(pageGroups.filter((group, index) => group !== pageGroups[index - 1])).toEqual(
      SETTINGS_GROUPS.map((group) => group.key)
    );
  });

  test('links every page exactly once', () => {
    renderWithProviders(<SettingsIndex />);
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect([...hrefs].sort()).toEqual(SETTINGS_PAGES.map((page) => `/settings/${page.key}`).sort());
  });

  test('shows each page title with its description', () => {
    renderWithProviders(<SettingsIndex />);
    const link = screen.getByRole('link', { name: /Storage Limits/ });
    expect(link).toHaveTextContent('Pause downloads when storage is full or over a size limit.');
  });

  test('puts the groups in two columns at 720px and wider', () => {
    renderWithProviders(<SettingsIndex />);
    expect(headingOrder()).toEqual(['Downloads & library', 'Automation & storage', 'Media servers', 'Integrations', 'System']);
  });

  test('stacks the groups in one column below 720px', () => {
    (useContainerWidth as jest.Mock).mockReturnValue([jest.fn(), 600]);
    renderWithProviders(<SettingsIndex />);
    expect(headingOrder()).toEqual(['Downloads & library', 'Media servers', 'Automation & storage', 'Integrations', 'System']);
  });
});
