import React from 'react';
import { act } from 'react-dom/test-utils';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChannelListRow from '../ChannelListRow';
import { Channel } from '../../../../types/Channel';
import { renderWithProviders } from '../../../../test-utils';

jest.mock('../chips', () => ({
  QualityChip: function MockQualityChip({ videoQuality, globalPreferredResolution }: any) {
    const React = require('react');
    return React.createElement(
      'div',
      {
        'data-testid': 'quality-chip',
        'data-quality': videoQuality,
        'data-global': globalPreferredResolution,
      },
      'Quality'
    );
  },
  SubFolderChip: function MockSubFolderChip({ subFolder }: any) {
    const React = require('react');
    return React.createElement(
      'div',
      {
        'data-testid': 'sub-folder-chip',
      },
      subFolder || 'Default Folder'
    );
  },
  AutoDownloadChips: function MockAutoDownloadChips({ availableTabs, autoDownloadTabs }: any) {
    const React = require('react');
    return React.createElement(
      'div',
      {
        'data-testid': 'auto-download-chips',
        'data-available': availableTabs,
        'data-enabled': autoDownloadTabs,
      },
      'Auto'
    );
  },
  DurationFilterChip: function MockDurationFilterChip({ minDuration, maxDuration }: any) {
    const React = require('react');
    if (!minDuration && !maxDuration) return null;
    return React.createElement(
      'div',
      {
        'data-testid': 'duration-filter-chip',
        'data-min': minDuration,
        'data-max': maxDuration,
      },
      'Duration'
    );
  },
  TitleFilterChip: function MockTitleFilterChip({ titleFilterRegex, onRegexClick }: any) {
    const React = require('react');
    if (!titleFilterRegex) return null;
    return React.createElement(
      'button',
      {
        'data-testid': 'title-filter-chip',
        onClick: (e: any) => onRegexClick(e, titleFilterRegex),
      },
      'Title Filter'
    );
  },
}));

describe('ChannelListRow', () => {
  const mockChannel: Channel = {
    url: 'https://www.youtube.com/@testchannel',
    uploader: 'Test Channel',
    channel_id: 'UC1234567890',
    auto_download_enabled_tabs: 'video',
    available_tabs: 'video,short,livestream',
    sub_folder: null,
    video_quality: '1080',
    min_duration: null,
    max_duration: null,
    title_filter_regex: null,
  };

  const defaultProps = {
    channel: mockChannel,
    isMobile: false,
    globalPreferredResolution: '1080',
    onNavigate: jest.fn(),
    onDelete: jest.fn(),
    onRegexClick: jest.fn(),
    isPendingAddition: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders uploader and chips on desktop', () => {
      renderWithProviders(<ChannelListRow {...defaultProps} />);

      expect(screen.getByText('Test Channel')).toBeInTheDocument();
      expect(screen.getByTestId('channel-list-row-UC1234567890')).toBeInTheDocument();
      expect(screen.getByTestId('quality-chip')).toHaveAttribute('data-quality', '1080');
      expect(screen.getByTestId('auto-download-chips')).toHaveAttribute('data-enabled', 'video');
      expect(screen.getByTestId('sub-folder-chip')).toHaveTextContent('Default Folder');
    });

    test('uses channel url in test id and default thumbnail when channel_id is missing', () => {
      const channelWithoutId = { ...mockChannel, channel_id: undefined };
      renderWithProviders(<ChannelListRow {...defaultProps} channel={channelWithoutId} />);

      expect(screen.getByTestId(`channel-list-row-${mockChannel.url}`)).toBeInTheDocument();

      const img = screen.getByAltText('Test Channel thumbnail');
      expect(img).toHaveAttribute('src', '/images/channelthumb-default.jpg');
    });

    test('hides thumbnail when loading fails', async () => {
      renderWithProviders(<ChannelListRow {...defaultProps} />);

      const img = screen.getByAltText('Test Channel thumbnail');

      act(() => {
        img.dispatchEvent(new Event('error'));
      });

      expect(screen.queryByAltText('Test Channel thumbnail')).not.toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    test('calls onNavigate when header is clicked on desktop', async () => {
      const user = userEvent.setup();
      const onNavigate = jest.fn();

      renderWithProviders(<ChannelListRow {...defaultProps} onNavigate={onNavigate} />);

      await user.click(screen.getByTestId('channel-list-row-UC1234567890'));

      expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    test('does not navigate and shows pending chip when addition is pending', async () => {
      const user = userEvent.setup();
      const onNavigate = jest.fn();

      renderWithProviders(
        <ChannelListRow
          {...defaultProps}
          onNavigate={onNavigate}
          isPendingAddition={true}
        />
      );

      await user.click(screen.getByTestId('channel-list-row-UC1234567890'));

      expect(onNavigate).not.toHaveBeenCalled();
      expect(screen.getByText('Pending addition')).toBeInTheDocument();
    });

    test('calls onDelete when delete button is clicked', async () => {
      const user = userEvent.setup();
      const onDelete = jest.fn();

      renderWithProviders(<ChannelListRow {...defaultProps} onDelete={onDelete} />);

      const deleteButton = screen.getByRole('button', { name: /remove channel/i });
      await user.click(deleteButton);

      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    test('calls onRegexClick when title filter chip is clicked', async () => {
      const user = userEvent.setup();
      const onRegexClick = jest.fn();
      const channelWithFilter = { ...mockChannel, title_filter_regex: '^test' };

      renderWithProviders(
        <ChannelListRow
          {...defaultProps}
          channel={channelWithFilter}
          onRegexClick={onRegexClick}
        />
      );

      await user.click(screen.getByTestId('title-filter-chip'));

      expect(onRegexClick).toHaveBeenCalledTimes(1);
      expect(onRegexClick).toHaveBeenCalledWith(expect.any(Object), '^test');
    });
  });

  describe('Mobile layout', () => {
    test('renders filter chips and handles regex click on mobile', async () => {
      const user = userEvent.setup();
      const onRegexClick = jest.fn();
      const channelWithFilters = {
        ...mockChannel,
        min_duration: 300,
        max_duration: 1200,
        title_filter_regex: 'example',
      };

      renderWithProviders(
        <ChannelListRow
          {...defaultProps}
          channel={channelWithFilters}
          isMobile={true}
          onRegexClick={onRegexClick}
        />
      );

      expect(screen.getByTestId('mobile-filter-chips')).toBeInTheDocument();
      expect(screen.getByTestId('duration-filter-chip')).toHaveAttribute('data-min', '300');

      await user.click(screen.getByTestId('title-filter-chip'));

      expect(onRegexClick).toHaveBeenCalledTimes(1);
    });
  });
});
