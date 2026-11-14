import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { renderWithProviders } from '../../../test-utils';
import { AboutSection } from '../AboutSection';
import { GITHUB_SPONSORS_URL, PATREON_URL } from '../../shared/SupportLinkButtons';
import packageJson from '../../../../package.json';

describe('AboutSection', () => {
  test('shows the running Youtarr version', () => {
    renderWithProviders(<AboutSection />);

    expect(screen.getByText(`Version v${packageJson.version}`)).toBeInTheDocument();
  });

  test('tells the origin story of the project', () => {
    renderWithProviders(<AboutSection />);

    expect(screen.getByRole('heading', { name: 'How Youtarr started' })).toBeInTheDocument();
    expect(screen.getByText(/shell scripts wrapped around yt-dlp/i)).toBeInTheDocument();
    expect(screen.getByText(/published it on GitHub/i)).toBeInTheDocument();
  });

  test('links to the docs, the repository and the Discord server', () => {
    renderWithProviders(<AboutSection />);

    expect(screen.getByRole('link', { name: 'Documentation' })).toHaveAttribute(
      'href',
      'https://dialmasterorg.github.io/Youtarr/'
    );
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/DialmasterOrg/Youtarr'
    );
    expect(screen.getByRole('link', { name: 'Discord' })).toHaveAttribute(
      'href',
      'https://discord.gg/68rvWnYMtD'
    );
  });

  test('links to the in-app changelog', () => {
    renderWithProviders(<AboutSection />);

    expect(screen.getByRole('link', { name: 'Changelog' })).toHaveAttribute('href', '/changelog');
  });

  test('offers both donation links', () => {
    renderWithProviders(<AboutSection />);

    expect(screen.getByRole('heading', { name: 'Support Youtarr' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /github sponsors/i })).toHaveAttribute('href', GITHUB_SPONSORS_URL);
    expect(screen.getByRole('link', { name: /patreon/i })).toHaveAttribute('href', PATREON_URL);
  });
});
