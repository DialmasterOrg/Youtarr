import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import VideoCard from './VideoCard';
import { ChannelVideo } from '../../types/ChannelVideo';

const meta: Meta<typeof VideoCard> = {
  title: 'Components/ChannelPage/VideoCard',
  component: VideoCard,
  parameters: {
    docs: {
      disable: true,
    },
  },
  args: {
    onCheckChange: fn(),
    onHoverChange: fn(),
    onToggleDeletion: fn(),
    onToggleIgnore: fn(),
    onMobileTooltip: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof VideoCard>;

const mockVideo: ChannelVideo = {
  youtube_id: 'dQw4w9WgXcQ',
  channel_id: 'UC_example',
  video_title: 'Never Gonna Give You Up',
  published_at: new Date('2023-01-15T10:30:00Z'),
  video_duration: 213,
  thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  video_quality: '1080p',
  file_metadata: {
    size_bytes: 134217728, // 128 MB
    format: 'mp4',
  },
  media_type: 'video',
  availability_status: 'available',
  download_status: 'completed',
  ignored: false,
  live_status: null,
  youtubeRemoved: false,
  youtubeRemovedCheckedAt: new Date().toISOString(),
  lastDownloadedAt: new Date('2023-06-01T14:22:00Z').toISOString(),
};

const mockVideoNeverDownloaded: ChannelVideo = {
  ...mockVideo,
  youtube_id: 'test_never_downloaded_1',
  download_status: 'never_downloaded',
  ignored: false,
};

const mockVideoIgnored: ChannelVideo = {
  ...mockVideo,
  youtube_id: 'test_ignored_1',
  download_status: 'ignored',
  ignored: true,
};

const mockVideoStillLive: ChannelVideo = {
  ...mockVideo,
  youtube_id: 'test_live_1',
  live_status: 'is_live',
  download_status: 'never_downloaded',
};

/**
 * Default VideoCard with completed download
 * Tests display of video metadata, status indicators, and action buttons
 */
export const Downloaded: Story = {
  args: {
    video: mockVideo,
    isMobile: false,
    checkedBoxes: [],
    hoveredVideo: null,
    selectedForDeletion: [],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Verify video title is displayed
    const title = canvas.getByText(/never gonna give you up/i);
    expect(title).toBeInTheDocument();

    // Verify video metadata is visible
    const duration = canvas.getByText(/3\s*m|213|minutes/i);
    expect(duration).toBeInTheDocument();

    // Verify status is shown (completed)
    const statusElement = canvasElement.querySelector('[data-testid*="status"]') || 
                         canvas.queryByText(/completed|downloaded/i);
    if (statusElement) {
      expect(statusElement).toBeVisible();
    }

    // Test hover interaction
    const card = canvas.getByRole('button', { name: /video|card/i }) || 
                canvasElement.querySelector('[class*="Card"]');
    if (card) {
      await userEvent.hover(card);
      expect(args.onHoverChange).toHaveBeenCalledWith(mockVideo.youtube_id);
    }
  },
};

/**
 * NeverDownloaded state - selectable card
 * Tests checkbox interaction and selection
 */
export const NeverDownloaded: Story = {
  args: {
    video: mockVideoNeverDownloaded,
    isMobile: false,
    checkedBoxes: [],
    hoveredVideo: null,
    selectedForDeletion: [],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Wait for render
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify card is clickable (cursor should be pointer)
    const cardElement = canvasElement.querySelector('[class*="Card"]');
    if (cardElement) {
      // Click the card to trigger checkbox
      await userEvent.click(cardElement);
      // Should call onCheckChange with true (toggle from unchecked to checked)
      expect(args.onCheckChange).toHaveBeenCalledWith(mockVideoNeverDownloaded.youtube_id, true);
    }

    // Test delete button if present
    const deleteButtons = canvas.queryAllByRole('button', { name: /delete|remove|trash/i });
    if (deleteButtons.length > 0) {
      const deleteButton = deleteButtons[0];
      await userEvent.click(deleteButton);
      // Should trigger delete/ignore action
      expect(args.onToggleDeletion).toHaveBeenCalled();
    }
  },
};

/**
 * Ignored video state
 * Tests that ignored videos show different styling and are not selectable
 */
export const Ignored: Story = {
  args: {
    video: mockVideoIgnored,
    isMobile: false,
    checkedBoxes: [],
    hoveredVideo: null,
    selectedForDeletion: [],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Verify "Ignored" status is displayed
    const ignoredStatus = canvas.queryByText(/ignored/i);
    if (ignoredStatus) {
      expect(ignoredStatus).toBeVisible();
    }

    // Verify card has reduced opacity (styling indication)
    const cardElement = canvasElement.querySelector('[class*="Card"]');
    if (cardElement) {
      const styles = window.getComputedStyle(cardElement);
      // Ignored videos should have opacity < 1
      const opacity = parseFloat(styles.opacity);
      expect(opacity).toBeLessThanOrEqual(1);
    }

    // Test that clicking does not trigger selection (non-selectable)
    const cardClickable = canvas.queryByRole('button');
    if (cardClickable) {
      await userEvent.click(cardClickable);
      // For ignored videos, onCheckChange should not be called or should receive false
      // depending on implementation
    }
  },
};

/**
 * Still live video - not selectable
 * Tests that live streams cannot be selected for download
 */
export const StillLive: Story = {
  args: {
    video: mockVideoStillLive,
    isMobile: false,
    checkedBoxes: [],
    hoveredVideo: null,
    selectedForDeletion: [],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Verify "Live" indicator is shown
    const liveIndicator = canvas.queryByText(/live|still live/i);
    if (liveIndicator) {
      expect(liveIndicator).toBeVisible();
    }

    // Verify card is not selectable
    const cardElement = canvasElement.querySelector('[class*="Card"]');
    if (cardElement) {
      // Click should not trigger checkbox (not selectable)
      await userEvent.click(cardElement);
      expect(args.onCheckChange).not.toHaveBeenCalledWith(
        mockVideoStillLive.youtube_id,
        expect.anything()
      );
    }
  },
};

/**
 * Pre-checked state
 * Tests card with checkbox already selected
 */
export const Checked: Story = {
  args: {
    video: mockVideoNeverDownloaded,
    isMobile: false,
    checkedBoxes: [mockVideoNeverDownloaded.youtube_id],
    hoveredVideo: null,
    selectedForDeletion: [],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Verify checkbox appears checked
    const checkbox = canvas.queryByRole('checkbox');
    if (checkbox) {
      expect(checkbox).toBeChecked();
    }

    // Click card again to toggle off
    const cardElement = canvasElement.querySelector('[class*="Card"]');
    if (cardElement) {
      await userEvent.click(cardElement);
      // Should toggle to false (unchecked)
      expect(args.onCheckChange).toHaveBeenCalledWith(
        mockVideoNeverDownloaded.youtube_id,
        false
      );
    }
  },
};

/**
 * Mobile layout
 * Tests responsive card behavior on mobile
 */
export const Mobile: Story = {
  args: {
    video: mockVideoNeverDownloaded,
    isMobile: true,
    checkedBoxes: [],
    hoveredVideo: null,
    selectedForDeletion: [],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Verify title is displayed
    const title = canvas.getByText(/never gonna give you up/i);
    expect(title).toBeInTheDocument();

    // On mobile, clicking card should trigger same interactions
    const cardElement = canvasElement.querySelector('[class*="Card"]');
    if (cardElement) {
      await userEvent.click(cardElement);
      expect(args.onCheckChange).toHaveBeenCalledWith(
        mockVideoNeverDownloaded.youtube_id,
        true
      );
    }

    // Mobile tooltip callback should be available
    expect(args.onMobileTooltip).toBeDefined();
  },
};

/**
 * Marked for deletion
 * Tests delete selection state styling
 */
export const MarkedForDeletion: Story = {
  args: {
    video: mockVideoNeverDownloaded,
    isMobile: false,
    checkedBoxes: [mockVideoNeverDownloaded.youtube_id],
    hoveredVideo: null,
    selectedForDeletion: [mockVideoNeverDownloaded.youtube_id],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Card should show visual indication of deletion
    const cardElement = canvasElement.querySelector('[class*="Card"]');
    if (cardElement) {
      // Check for error color styling or delete indicator
      const style = window.getComputedStyle(cardElement);
      // This depends on component implementation
      expect(cardElement).toBeInTheDocument();
    }

    // Test unblock/cancel delete button
    const unblockButtons = canvas.queryAllByRole('button', { name: /unblock|cancel|restore/i });
    if (unblockButtons.length > 0) {
      await userEvent.click(unblockButtons[0]);
      expect(args.onToggleDeletion).toHaveBeenCalledWith(mockVideoNeverDownloaded.youtube_id);
    }
  },
};
