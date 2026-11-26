import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChannelVideosTabs from '../ChannelVideosTabs';
import { renderWithProviders } from '../../../../test-utils';

type Props = React.ComponentProps<typeof ChannelVideosTabs>;

describe('ChannelVideosTabs', () => {
  const onChange = jest.fn();

  const renderTabs = (props: Partial<Props> = {}) =>
    renderWithProviders(
      <ChannelVideosTabs
        availableTabs={['videos', 'shorts', 'streams']}
        selectedTab="videos"
        tabStats={null}
        isMobile={false}
        onChange={onChange}
        {...props}
      />
    );

  const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(name) });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('names the tabs Videos, Shorts and Live', () => {
    renderTabs();

    expect(screen.getAllByRole('tab').map((element) => element.textContent)).toEqual([
      'Videos',
      'Shorts',
      'Live',
    ]);
  });

  test('shows only the tabs the channel has', () => {
    renderTabs({ availableTabs: ['videos'] });

    expect(screen.getAllByRole('tab')).toHaveLength(1);
  });

  test('marks the selected tab', () => {
    renderTabs({ selectedTab: 'shorts' });

    expect(tab('Shorts')).toHaveAttribute('aria-selected', 'true');
  });

  test('marks Videos until a tab is selected', () => {
    renderTabs({ selectedTab: null });

    expect(tab('Videos')).toHaveAttribute('aria-selected', 'true');
  });

  test('reports the tab that was clicked', async () => {
    renderTabs();

    await userEvent.click(tab('Live'));

    expect(onChange).toHaveBeenCalledWith(expect.anything(), 'streams');
  });

  test('marks the tabs whose media type downloads automatically', () => {
    renderTabs({ autoDownloadTabs: 'video, livestream' });

    expect(within(tab('Videos')).getByTitle('Auto-download enabled')).toBeInTheDocument();
    expect(within(tab('Shorts')).getByTitle('Auto-download disabled')).toBeInTheDocument();
    expect(within(tab('Live')).getByTitle('Auto-download enabled')).toBeInTheDocument();
  });

  test('marks every tab as not downloading automatically when the channel has no setting', () => {
    renderTabs();

    expect(screen.getAllByTitle('Auto-download disabled')).toHaveLength(3);
  });

  test('shows how much of a counted tab is downloaded', () => {
    renderTabs({
      tabStats: { videos: { total: 10, fetchedAt: null, downloaded: 5, ignored: 0, percent: 50, loaded: 8 } },
    });

    expect(screen.getByRole('progressbar', { name: 'Videos: 5 of 10 downloaded' })).toBeInTheDocument();
  });

  test('shows no progress for a tab that has not been counted', () => {
    renderTabs();

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
