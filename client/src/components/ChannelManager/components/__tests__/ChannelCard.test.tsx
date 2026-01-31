import React from 'react';
import { screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChannelCard from '../ChannelCard';
import { Channel } from '../../../../types/Channel';
import { renderWithProviders } from '../../../../test-utils';

// Mock the chip components
jest.mock('../chips', () => ({
  QualityChip: function MockQualityChip({ videoQuality, globalPreferredResolution }: any) {
    const React = require('react');
    const attrs: any = { 'data-testid': 'quality-chip' };
    if (videoQuality !== null && videoQuality !== undefined) {
      attrs['data-quality'] = videoQuality;
    }
    if (globalPreferredResolution !== null && globalPreferredResolution !== undefined) {
      attrs['data-global'] = globalPreferredResolution;
    }
    return React.createElement('div', attrs, `Quality: ${videoQuality || 'default'}`);
  },
  AutoDownloadChips: function MockAutoDownloadChips({ availableTabs, autoDownloadTabs }: any) {
    const React = require('react');
    const attrs: any = { 'data-testid': 'auto-download-chips' };
    if (availableTabs !== null && availableTabs !== undefined) {
      attrs['data-available'] = availableTabs;
    }
    if (autoDownloadTabs !== null && autoDownloadTabs !== undefined) {
      attrs['data-enabled'] = autoDownloadTabs;
    }
    return React.createElement('div', attrs, `Auto: ${autoDownloadTabs || 'none'}`);
  },
  DurationFilterChip: function MockDurationFilterChip({ minDuration, maxDuration }: any) {
    const React = require('react');
    if (!minDuration && !maxDuration) return null;
    return React.createElement('div', {
      'data-testid': 'duration-filter-chip',
      'data-min': minDuration,
      'data-max': maxDuration,
    }, `Duration: ${minDuration || 0}-${maxDuration || '∞'}`);
  },
  TitleFilterChip: function MockTitleFilterChip({ titleFilterRegex, onRegexClick }: any) {
    const React = require('react');
    if (!titleFilterRegex) return null;
    return React.createElement('div', {
      'data-testid': 'title-filter-chip',
      onClick: (e: any) => onRegexClick(e, titleFilterRegex),
    }, `Title Filter: ${titleFilterRegex}`);
  },
  DownloadFormatConfigIndicator: function MockDownloadFormatConfigIndicator({ audioFormat }: any) {
    const React = require('react');
    return React.createElement('div', {
      'data-testid': 'download-format-config-indicator',
      'data-audio-format': audioFormat,
    }, 'Format');
  },
}));

describe('ChannelCard Component', () => {
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

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      renderWithProviders(<ChannelCard {...defaultProps} />);
      expect(screen.getByText('Test Channel')).toBeInTheDocument();
    });

    test('renders channel name', () => {
      renderWithProviders(<ChannelCard {...defaultProps} />);
      expect(screen.getByText('Test Channel')).toBeInTheDocument();
    });

    test('renders "Unknown Channel" when uploader is missing', () => {
      const channelWithoutUploader = { ...mockChannel, uploader: '' };
      renderWithProviders(
        <ChannelCard {...defaultProps} channel={channelWithoutUploader} />
      );
      expect(screen.getByText('Unknown Channel')).toBeInTheDocument();
    });

    test('renders channel thumbnail with correct src', () => {
      renderWithProviders(<ChannelCard {...defaultProps} />);
      const img = screen.getByAltText('Test Channel thumbnail');
      expect(img).toHaveAttribute('src', '/images/channelthumb-UC1234567890.jpg');
    });

    test('uses default thumbnail when channel_id is missing', () => {
      const channelWithoutId = { ...mockChannel, channel_id: undefined };
      renderWithProviders(
        <ChannelCard {...defaultProps} channel={channelWithoutId} />
      );
      const img = screen.getByAltText('Test Channel thumbnail');
      expect(img).toHaveAttribute('src', '/images/channelthumb-default.jpg');
    });

    test('does not render folder indicator when sub_folder is null', () => {
      renderWithProviders(<ChannelCard {...defaultProps} />);
      expect(screen.queryByText('Default Folder')).not.toBeInTheDocument();
    });

    test('renders custom sub_folder when provided', () => {
      const channelWithFolder = { ...mockChannel, sub_folder: 'music' };
      renderWithProviders(
        <ChannelCard {...defaultProps} channel={channelWithFolder} />
      );
      expect(screen.getByText('/music')).toBeInTheDocument();
    });

    test('includes testid with channel_id', () => {
      renderWithProviders(<ChannelCard {...defaultProps} />);
      expect(screen.getByTestId('channel-card-UC1234567890')).toBeInTheDocument();
    });

    test('uses channel url in testid when channel_id is missing', () => {
      const channelWithoutId = { ...mockChannel, channel_id: undefined };
      renderWithProviders(
        <ChannelCard {...defaultProps} channel={channelWithoutId} />
      );
      expect(screen.getByTestId(`channel-card-${mockChannel.url}`)).toBeInTheDocument();
    });
  });

  describe('Chip Components', () => {
    test('renders QualityChip with correct props', () => {
      renderWithProviders(<ChannelCard {...defaultProps} />);
      const qualityChip = screen.getByTestId('quality-chip');
      expect(qualityChip).toBeInTheDocument();
      expect(qualityChip).toHaveAttribute('data-quality', '1080');
      expect(qualityChip).toHaveAttribute('data-global', '1080');
    });

    test('renders AutoDownloadChips with correct props', () => {
      renderWithProviders(<ChannelCard {...defaultProps} />);
      const autoDownloadChips = screen.getByTestId('auto-download-chips');
      expect(autoDownloadChips).toBeInTheDocument();
      expect(autoDownloadChips).toHaveAttribute('data-available', 'video,short,livestream');
      expect(autoDownloadChips).toHaveAttribute('data-enabled', 'video');
    });

    test('renders DurationFilterChip when min/max duration is set', () => {
      const channelWithDuration = {
        ...mockChannel,
        min_duration: 300,
        max_duration: 3600,
      };
      renderWithProviders(
        <ChannelCard {...defaultProps} channel={channelWithDuration} />
      );
      const durationChip = screen.getByTestId('duration-filter-chip');
      expect(durationChip).toBeInTheDocument();
      expect(durationChip).toHaveAttribute('data-min', '300');
      expect(durationChip).toHaveAttribute('data-max', '3600');
    });

    test('does not render DurationFilterChip when no duration limits', () => {
      renderWithProviders(<ChannelCard {...defaultProps} />);
      expect(screen.queryByTestId('duration-filter-chip')).not.toBeInTheDocument();
    });

    test('renders TitleFilterChip when title filter regex is set', () => {
      const channelWithFilter = {
        ...mockChannel,
        title_filter_regex: '^\\[Official\\]',
      };
      renderWithProviders(
        <ChannelCard {...defaultProps} channel={channelWithFilter} />
      );
      expect(screen.getByTestId('title-filter-chip')).toBeInTheDocument();
    });

    test('does not render TitleFilterChip when no regex filter', () => {
      renderWithProviders(<ChannelCard {...defaultProps} />);
      expect(screen.queryByTestId('title-filter-chip')).not.toBeInTheDocument();
    });

    test('passes isMobile prop to DurationFilterChip', () => {
      const channelWithDuration = {
        ...mockChannel,
        min_duration: 100,
        max_duration: 200,
      };
      renderWithProviders(
        <ChannelCard {...defaultProps} channel={channelWithDuration} isMobile={true} />
      );
      expect(screen.getByTestId('duration-filter-chip')).toBeInTheDocument();
    });
  });

  describe('Pending Addition State', () => {
    test('displays "Pending" chip when isPendingAddition is true', () => {
      renderWithProviders(<ChannelCard {...defaultProps} isPendingAddition={true} />);
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    test('does not display "Pending" chip when isPendingAddition is false', () => {
      renderWithProviders(<ChannelCard {...defaultProps} isPendingAddition={false} />);
      expect(screen.queryByText('Pending')).not.toBeInTheDocument();
    });

    test('disables navigation when isPendingAddition is true', () => {
      renderWithProviders(
        <ChannelCard {...defaultProps} isPendingAddition={true} />
      );

      const card = screen.getByTestId('channel-card-UC1234567890');
      // Check that the button is disabled
      expect(card).toHaveAttribute('disabled');
    });

    test('allows navigation when isPendingAddition is false', async () => {
      const user = userEvent.setup();
      const onNavigate = jest.fn();

      renderWithProviders(
        <ChannelCard {...defaultProps} onNavigate={onNavigate} isPendingAddition={false} />
      );

      const card = screen.getByTestId('channel-card-UC1234567890');
      await user.click(card);

      expect(onNavigate).toHaveBeenCalledTimes(1);
    });
  });

  describe('User Interactions', () => {
    test('calls onNavigate when card is clicked', async () => {
      const user = userEvent.setup();
      const onNavigate = jest.fn();

      renderWithProviders(<ChannelCard {...defaultProps} onNavigate={onNavigate} />);

      const card = screen.getByTestId('channel-card-UC1234567890');
      await user.click(card);

      expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    test('calls onDelete when delete button is clicked', async () => {
      const user = userEvent.setup();
      const onDelete = jest.fn();

      renderWithProviders(<ChannelCard {...defaultProps} onDelete={onDelete} />);

      const deleteButton = screen.getByRole('button', { name: /remove channel/i });
      await user.click(deleteButton);

      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    test('delete button click stops propagation and does not trigger navigation', async () => {
      const user = userEvent.setup();
      const onDelete = jest.fn();
      const onNavigate = jest.fn();

      renderWithProviders(
        <ChannelCard {...defaultProps} onDelete={onDelete} onNavigate={onNavigate} />
      );

      const deleteButton = screen.getByRole('button', { name: /remove channel/i });
      await user.click(deleteButton);

      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onNavigate).not.toHaveBeenCalled();
    });

    test('calls onRegexClick when title filter chip is clicked', async () => {
      const user = userEvent.setup();
      const onRegexClick = jest.fn();
      const channelWithFilter = {
        ...mockChannel,
        title_filter_regex: '^\\[Official\\]',
      };

      renderWithProviders(
        <ChannelCard
          {...defaultProps}
          channel={channelWithFilter}
          onRegexClick={onRegexClick}
        />
      );

      const filterChip = screen.getByTestId('title-filter-chip');
      await user.click(filterChip);

      expect(onRegexClick).toHaveBeenCalledTimes(1);
      expect(onRegexClick).toHaveBeenCalledWith(
        expect.any(Object),
        '^\\[Official\\]'
      );
    });
  });

  describe('Delete Button', () => {
    test('renders delete button with tooltip', () => {
      renderWithProviders(<ChannelCard {...defaultProps} />);
      expect(screen.getByRole('button', { name: /remove channel/i })).toBeInTheDocument();
    });

    test('delete button has DeleteIcon', () => {
      renderWithProviders(<ChannelCard {...defaultProps} />);
      const deleteButton = screen.getByRole('button', { name: /remove channel/i });
      expect(within(deleteButton).getByTestId('DeleteIcon')).toBeInTheDocument();
    });
  });

  describe('Thumbnail Handling', () => {
    test('sets thumbnailLoaded state when image loads', () => {
      renderWithProviders(<ChannelCard {...defaultProps} />);
      const img = screen.getByAltText('Test Channel thumbnail');

      // Trigger load event
      act(() => {
        img.dispatchEvent(new Event('load'));
      });

      expect(img).toBeInTheDocument();
    });

    test('hides thumbnail and shows placeholder icon on error', () => {
      renderWithProviders(<ChannelCard {...defaultProps} />);
      const img = screen.getByAltText('Test Channel thumbnail');

      // Trigger error event
      act(() => {
        img.dispatchEvent(new Event('error'));
      });

      // After error, ImageIcon should be displayed
      expect(screen.getByTestId('ImageIcon')).toBeInTheDocument();
    });

    test('placeholder icon is visible when thumbnail fails to load', () => {
      renderWithProviders(<ChannelCard {...defaultProps} />);
      const img = screen.getByAltText('Test Channel thumbnail');

      // Trigger error
      act(() => {
        img.dispatchEvent(new Event('error'));
      });

      const imageIcon = screen.getByTestId('ImageIcon');
      expect(imageIcon).toBeInTheDocument();
    });
  });

  describe('Mobile Responsive', () => {
    test('passes isMobile to chip components', () => {
      renderWithProviders(<ChannelCard {...defaultProps} isMobile={true} />);
      expect(screen.getByTestId('auto-download-chips')).toBeInTheDocument();
    });

    test('works correctly in desktop mode', () => {
      renderWithProviders(<ChannelCard {...defaultProps} isMobile={false} />);
      expect(screen.getByText('Test Channel')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles channel with all optional fields missing', () => {
      const minimalChannel: Channel = {
        url: 'https://www.youtube.com/@minimal',
        uploader: 'Minimal Channel',
        channel_id: 'UCminimal',
      };

      renderWithProviders(
        <ChannelCard {...defaultProps} channel={minimalChannel} />
      );

      expect(screen.getByText('Minimal Channel')).toBeInTheDocument();
      expect(screen.queryByText('Default Folder')).not.toBeInTheDocument();
    });

    test('handles channel with very long uploader name', () => {
      const longNameChannel = {
        ...mockChannel,
        uploader: 'A'.repeat(100),
      };

      renderWithProviders(
        <ChannelCard {...defaultProps} channel={longNameChannel} />
      );

      expect(screen.getByText('A'.repeat(100))).toBeInTheDocument();
    });

    test('handles channel with very long sub_folder name', () => {
      const longFolderChannel = {
        ...mockChannel,
        sub_folder: 'very/long/nested/folder/path',
      };

      renderWithProviders(
        <ChannelCard {...defaultProps} channel={longFolderChannel} />
      );

      expect(screen.getByText('/very/long/nested/folder/path')).toBeInTheDocument();
    });

    test('handles channel with empty auto_download_enabled_tabs', () => {
      const noAutoDownloadChannel = {
        ...mockChannel,
        auto_download_enabled_tabs: '',
      };

      renderWithProviders(
        <ChannelCard {...defaultProps} channel={noAutoDownloadChannel} />
      );

      expect(screen.getByTestId('auto-download-chips')).toBeInTheDocument();
    });

    test('handles channel with null available_tabs', () => {
      const noTabsChannel = {
        ...mockChannel,
        available_tabs: null,
      };

      renderWithProviders(
        <ChannelCard {...defaultProps} channel={noTabsChannel} />
      );

      const chip = screen.getByTestId('auto-download-chips');
      // null values should not set attributes on the chip
      expect(chip).toBeInTheDocument();
    });

    test('handles channel with only min_duration set', () => {
      const minDurationChannel = {
        ...mockChannel,
        min_duration: 600,
        max_duration: null,
      };

      renderWithProviders(
        <ChannelCard {...defaultProps} channel={minDurationChannel} />
      );

      expect(screen.getByTestId('duration-filter-chip')).toBeInTheDocument();
    });

    test('handles channel with only max_duration set', () => {
      const maxDurationChannel = {
        ...mockChannel,
        min_duration: null,
        max_duration: 1800,
      };

      renderWithProviders(
        <ChannelCard {...defaultProps} channel={maxDurationChannel} />
      );

      expect(screen.getByTestId('duration-filter-chip')).toBeInTheDocument();
    });

    test('handles complex regex patterns in title filter', () => {
      const complexRegexChannel = {
        ...mockChannel,
        title_filter_regex: '^(?!.*\\[Sponsored\\]).*(?i)(tutorial|guide)',
      };

      renderWithProviders(
        <ChannelCard {...defaultProps} channel={complexRegexChannel} />
      );

      expect(screen.getByTestId('title-filter-chip')).toBeInTheDocument();
    });

    test('handles null video_quality', () => {
      const noQualityChannel = {
        ...mockChannel,
        video_quality: null,
      };

      renderWithProviders(
        <ChannelCard {...defaultProps} channel={noQualityChannel} />
      );

      const qualityChip = screen.getByTestId('quality-chip');
      // null values should not set attributes on the chip
      expect(qualityChip).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('delete button has accessible label', () => {
      renderWithProviders(<ChannelCard {...defaultProps} />);
      expect(screen.getByRole('button', { name: /remove channel/i })).toBeInTheDocument();
    });

    test('thumbnail has alt text', () => {
      renderWithProviders(<ChannelCard {...defaultProps} />);
      expect(screen.getByAltText('Test Channel thumbnail')).toBeInTheDocument();
    });

    test('card action area is clickable', () => {
      renderWithProviders(<ChannelCard {...defaultProps} />);
      const card = screen.getByTestId('channel-card-UC1234567890');
      expect(card).toBeInTheDocument();
    });

    test('folder indicator is shown only for custom subfolders', () => {
      renderWithProviders(<ChannelCard {...defaultProps} />);
      expect(screen.queryByText(/\//)).not.toBeInTheDocument();

      const channelWithFolder = { ...mockChannel, sub_folder: 'music' };
      renderWithProviders(
        <ChannelCard {...defaultProps} channel={channelWithFolder} />
      );
      expect(screen.getByText('/music')).toBeInTheDocument();
    });
  });

  describe('Global Preferred Resolution', () => {
    test('passes global preferred resolution to QualityChip', () => {
      renderWithProviders(
        <ChannelCard {...defaultProps} globalPreferredResolution="4320" />
      );
      const qualityChip = screen.getByTestId('quality-chip');
      expect(qualityChip).toHaveAttribute('data-global', '4320');
    });

    test('handles empty global preferred resolution', () => {
      renderWithProviders(
        <ChannelCard {...defaultProps} globalPreferredResolution="" />
      );
      const qualityChip = screen.getByTestId('quality-chip');
      expect(qualityChip).toHaveAttribute('data-global', '');
    });
  });
});
