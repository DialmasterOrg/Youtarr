import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { YouTubeApiSection } from '../YouTubeApiSection';
import { ConfigState } from '../../types';

function makeConfig(overrides: Partial<ConfigState> = {}): ConfigState {
  return {
    youtubeApiKey: '',
    ...overrides,
  } as ConfigState;
}

describe('YouTubeApiSection', () => {
  const defaultProps = {
    config: makeConfig(),
    status: 'not_tested' as const,
    lastValidatedAt: null,
    lastReason: null,
    onConfigChange: jest.fn(),
    onTestKey: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  test('renders heading and setup guide', () => {
    render(<YouTubeApiSection {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /YouTube Data API/i })).toBeInTheDocument();
    expect(screen.getByText(/Google Cloud Console/i)).toBeInTheDocument();
  });

  test('explains why a YouTube API key is useful', () => {
    render(<YouTubeApiSection {...defaultProps} />);
    expect(screen.getByText(/Faster, more accurate YouTube lookups/i)).toBeInTheDocument();
    expect(screen.getByText(/channel video lists/i)).toBeInTheDocument();
    expect(screen.getByText(/significantly faster/i)).toBeInTheDocument();
    expect(screen.getByText(/precise published dates/i)).toBeInTheDocument();
    expect(screen.getByText(/falls back to yt-dlp automatically/i)).toBeInTheDocument();
  });

  test('shows Not Tested chip when status is not_tested', () => {
    render(<YouTubeApiSection {...defaultProps} />);
    expect(screen.getByText('Not Tested')).toBeInTheDocument();
  });

  test('shows Valid chip when status is valid', () => {
    render(<YouTubeApiSection {...defaultProps} status="valid" />);
    expect(screen.getByText('Valid')).toBeInTheDocument();
  });

  test('shows Quota Exhausted chip for quota_exhausted status', () => {
    render(<YouTubeApiSection {...defaultProps} status="quota_exhausted" />);
    expect(screen.getByText('Quota Exhausted')).toBeInTheDocument();
  });

  test('shows Rate Limited chip for rate_limited status', () => {
    render(<YouTubeApiSection {...defaultProps} status="rate_limited" />);
    expect(screen.getByText('Rate Limited')).toBeInTheDocument();
  });

  test('calls onConfigChange when key is typed', () => {
    render(<YouTubeApiSection {...defaultProps} />);
    const input = screen.getByLabelText(/YouTube Data API Key/i);
    fireEvent.change(input, { target: { value: 'AIza-xxx' } });
    expect(defaultProps.onConfigChange).toHaveBeenCalledWith({ youtubeApiKey: 'AIza-xxx' });
  });

  test('Test button is disabled when key is empty', () => {
    render(<YouTubeApiSection {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Test Key/i })).toBeDisabled();
  });

  test('Test button is disabled while testing', () => {
    render(<YouTubeApiSection {...defaultProps} config={makeConfig({ youtubeApiKey: 'k' })} status="testing" />);
    const button = screen.getByRole('button', { name: /Testing\.\.\./i });
    expect(button).toBeDisabled();
  });

  test('clicking Test calls onTestKey', () => {
    render(<YouTubeApiSection {...defaultProps} config={makeConfig({ youtubeApiKey: 'k' })} />);
    fireEvent.click(screen.getByRole('button', { name: /Test Key/i }));
    expect(defaultProps.onTestKey).toHaveBeenCalledTimes(1);
  });

  test('renders last validated timestamp when present', () => {
    const now = new Date('2026-04-23T12:00:00Z');
    render(<YouTubeApiSection {...defaultProps} status="valid" lastValidatedAt={now} />);
    expect(screen.getByText(/Last validated/i)).toBeInTheDocument();
  });
});
