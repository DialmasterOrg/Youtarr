import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AutoRemovalRulesSummary } from '../AutoRemovalRulesSummary';
import { renderWithProviders } from '../../../../../test-utils';
import { ConfigState } from '../../../types';
import { DEFAULT_CONFIG } from '../../../../../config/configSchema';

const createConfig = (overrides: Partial<ConfigState> = {}): ConfigState => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

describe('AutoRemovalRulesSummary', () => {
  test('renders nothing when no rules are configured', () => {
    renderWithProviders(<AutoRemovalRulesSummary config={createConfig()} />);

    expect(screen.queryByText(/a video is deleted/i)).not.toBeInTheDocument();
  });

  test('uses singular phrasing for a single rule', () => {
    renderWithProviders(
      <AutoRemovalRulesSummary
        config={createConfig({ autoRemovalVideoAgeThreshold: '365' })}
      />
    );

    expect(
      screen.getByText(/a video is deleted if it matches this rule:/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/older than/i)).toHaveTextContent(
      "It's older than 1 year"
    );
  });

  test('joins multiple rules with or', () => {
    renderWithProviders(
      <AutoRemovalRulesSummary
        config={createConfig({
          autoRemovalVideoAgeThreshold: '365',
          autoRemovalFreeSpaceThreshold: '5GB',
        })}
      />
    );

    expect(
      screen.getByText(/a video is deleted if it matches any of these rules:/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/older than/i)).toHaveTextContent(
      "It's older than 1 year, or"
    );
    expect(screen.getByText(/Free space is below/i)).toHaveTextContent(
      'Free space is below 5GB (the oldest videos are deleted first until space is freed)'
    );
  });

  test('describes the watched rule with its sub-conditions', () => {
    renderWithProviders(
      <AutoRemovalRulesSummary
        config={createConfig({
          autoRemovalWatchedEnabled: true,
          autoRemovalWatchedMinDaysSinceWatched: '7',
          autoRemovalWatchedMinVideoAgeDays: '14',
        })}
      />
    );

    expect(screen.getByText(/It's been watched/i)).toHaveTextContent(
      "It's been watched, its last watch was at least 7 days ago, and it was downloaded at least 14 days ago"
    );
  });

  test('describes the watched rule without sub-conditions', () => {
    renderWithProviders(
      <AutoRemovalRulesSummary
        config={createConfig({ autoRemovalWatchedEnabled: true })}
      />
    );

    expect(screen.getByText(/It's been watched/i)).toHaveTextContent(
      "It's been watched"
    );
    expect(screen.queryByText(/last watch/i)).not.toBeInTheDocument();
  });

  test('always lists protected videos as kept', () => {
    renderWithProviders(
      <AutoRemovalRulesSummary
        config={createConfig({ autoRemovalVideoAgeThreshold: '30' })}
      />
    );

    expect(screen.getByText(/Always kept:/i)).toHaveTextContent(
      'Always kept: Protected videos.'
    );
  });

  test('includes the keep-recent count in the kept line when set', () => {
    renderWithProviders(
      <AutoRemovalRulesSummary
        config={createConfig({
          autoRemovalVideoAgeThreshold: '30',
          autoRemovalKeepRecentCount: 50,
        })}
      />
    );

    expect(screen.getByText(/Always kept:/i)).toHaveTextContent(
      'Always kept: Protected videos, and the 50 newest downloads.'
    );
  });
});
