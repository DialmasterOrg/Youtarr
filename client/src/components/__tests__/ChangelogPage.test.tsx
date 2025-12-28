import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChangelogPage from '../ChangelogPage';

// Mock react-markdown (ESM-only module)
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: function MockReactMarkdown({ children }: { children: string }) {
    const React = require('react');
    // Simple mock that renders markdown as plain text with basic parsing
    const lines = children.split('\n');
    return React.createElement(
      'div',
      { 'data-testid': 'react-markdown' },
      lines.map((line: string, index: number) => {
        // Handle headers
        if (line.startsWith('### ')) {
          return React.createElement('h3', { key: index }, line.replace('### ', ''));
        }
        if (line.startsWith('## ')) {
          return React.createElement('h2', { key: index }, line.replace('## ', ''));
        }
        if (line.startsWith('# ')) {
          return React.createElement('h1', { key: index }, line.replace('# ', ''));
        }
        // Handle list items
        if (line.startsWith('- ')) {
          return React.createElement('li', { key: index }, line.replace('- ', ''));
        }
        // Handle empty lines
        if (line.trim() === '') {
          return null;
        }
        // Regular text
        return React.createElement('p', { key: index }, line);
      })
    );
  },
}));

// Mock the useChangelog hook
jest.mock('../../hooks/useChangelog');

const { useChangelog } = require('../../hooks/useChangelog');

describe('ChangelogPage', () => {
  const mockRefetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders loading state with spinner', () => {
    useChangelog.mockReturnValue({
      content: null,
      loading: true,
      error: null,
      refetch: mockRefetch,
    });

    render(<ChangelogPage />);

    expect(screen.getByRole('heading', { name: /changelog/i })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders changelog content when loaded successfully', () => {
    const markdownContent = '# Version 1.0.0\n\n- Initial release\n- Added features';

    useChangelog.mockReturnValue({
      content: markdownContent,
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<ChangelogPage />);

    expect(screen.getByRole('heading', { name: /changelog/i })).toBeInTheDocument();
    expect(screen.getByText('Version 1.0.0')).toBeInTheDocument();
    expect(screen.getByText('Initial release')).toBeInTheDocument();
    expect(screen.getByText('Added features')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  test('renders error state with warning and retry button', () => {
    useChangelog.mockReturnValue({
      content: null,
      loading: false,
      error: 'Failed to fetch changelog: Not Found',
      refetch: mockRefetch,
    });

    render(<ChangelogPage />);

    expect(screen.getByRole('heading', { name: /changelog/i })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/unable to load changelog/i)).toBeInTheDocument();
    expect(screen.getByText(/failed to fetch changelog: not found/i)).toBeInTheDocument();
    expect(screen.getByText(/you can view the changelog directly on github/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /github\.com/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  test('calls refetch when refresh button is clicked', async () => {
    const user = userEvent.setup();

    useChangelog.mockReturnValue({
      content: '# Changelog',
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<ChangelogPage />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  test('calls refetch when retry button is clicked in error state', async () => {
    const user = userEvent.setup();

    useChangelog.mockReturnValue({
      content: null,
      loading: false,
      error: 'Network error',
      refetch: mockRefetch,
    });

    render(<ChangelogPage />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  test('disables refresh button when loading', () => {
    useChangelog.mockReturnValue({
      content: null,
      loading: true,
      error: null,
      refetch: mockRefetch,
    });

    render(<ChangelogPage />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    expect(refreshButton).toBeDisabled();
  });

  test('renders GitHub link with correct URL in error state', () => {
    useChangelog.mockReturnValue({
      content: null,
      loading: false,
      error: 'Some error',
      refetch: mockRefetch,
    });

    render(<ChangelogPage />);

    const githubLink = screen.getByRole('link', { name: /github\.com/i });
    expect(githubLink).toHaveAttribute('href', 'https://github.com/DialmasterOrg/Youtarr/blob/main/CHANGELOG.md');
    expect(githubLink).toHaveAttribute('target', '_blank');
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('does not show content while loading even if content exists', () => {
    useChangelog.mockReturnValue({
      content: '# Old cached content',
      loading: true,
      error: null,
      refetch: mockRefetch,
    });

    render(<ChangelogPage />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('Old cached content')).not.toBeInTheDocument();
  });

  test('renders markdown with proper structure', () => {
    const markdownContent = `# Release Notes

## [1.2.0] - 2024-01-15

### Added
- New feature A
- New feature B

### Fixed
- Bug fix X`;

    useChangelog.mockReturnValue({
      content: markdownContent,
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<ChangelogPage />);

    expect(screen.getByText('Release Notes')).toBeInTheDocument();
    expect(screen.getByText('[1.2.0] - 2024-01-15')).toBeInTheDocument();
    expect(screen.getByText('Added')).toBeInTheDocument();
    expect(screen.getByText('Fixed')).toBeInTheDocument();
    expect(screen.getByText('New feature A')).toBeInTheDocument();
    expect(screen.getByText('Bug fix X')).toBeInTheDocument();
  });
});
