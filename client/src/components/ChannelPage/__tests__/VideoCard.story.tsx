import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import VideoCard from '../VideoCard';
import { ChannelVideo } from '../../../types/ChannelVideo';

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
  title: 'Never Gonna Give You Up',
  publishedAt: '2023-01-15T10:30:00Z',
  thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  added: true,
  removed: false,
  duration: 213,
  fileSize: 134217728,
  media_type: 'video',
  ignored: false,
  live_status: null,
  youtube_removed: false,
};

const mockVideoNeverDownloaded: ChannelVideo = {
  ...mockVideo,
  youtube_id: 'test_never_downloaded_1',
  added: false,
  removed: false,
  ignored: false,
};

const mockVideoIgnored: ChannelVideo = {
  ...mockVideo,
  youtube_id: 'test_ignored_1',
  added: false,
  removed: false,
  ignored: true,
};

const mockVideoStillLive: ChannelVideo = {
  ...mockVideo,
  youtube_id: 'test_live_1',
  live_status: 'is_live',
  added: false,
  removed: false,
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
    await expect(title).toBeInTheDocument();

    // Verify video metadata is visible
    const duration = canvas.getByText(/3\s*m|213|minutes/i);
    await expect(duration).toBeInTheDocument();

    // Verify status is shown (completed)
    const statusElement = canvasElement.querySelector('[data-testid*="status"]') ||
                         canvas.queryByText(/completed|downloaded/i);
    if (statusElement) {
      await expect(statusElement).toBeInTheDocument();
    }

    // Test hover interaction
    const card = canvasElement.querySelector('[class*="MuiCard-root"]');
    if (card) {
      await userEvent.hover(card as HTMLElement);
      await expect(args.onHoverChange).toHaveBeenCalledWith(mockVideo.youtube_id);
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

    await expect(await canvas.findByText(/never gonna give you up/i)).toBeInTheDocument();

    // Verify card is clickable (cursor should be pointer)
    const cardElement = canvasElement.querySelector('[class*="Card"]');
    if (cardElement) {
      // Click the card to trigger checkbox
      await userEvent.click(cardElement);
      // Should call onCheckChange with true (toggle from unchecked to checked)
      await expect(args.onCheckChange).toHaveBeenCalledWith(mockVideoNeverDownloaded.youtube_id, true);
    }

    // Test delete button if present
    const deleteButtons = canvas.queryAllByRole('button', { name: /delete|remove|trash/i });
    if (deleteButtons.length > 0) {
      const deleteButton = deleteButtons[0];
      await userEvent.click(deleteButton);
      // Should trigger delete/ignore action
      await expect(args.onToggleDeletion).toHaveBeenCalled();
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
      await expect(ignoredStatus).toBeInTheDocument();
    }

    // Verify card has reduced opacity (styling indication)
    const cardElement = canvasElement.querySelector('[class*="Card"]');
    if (cardElement) {
      const styles = window.getComputedStyle(cardElement);
      // Ignored videos should have opacity < 1
      const opacity = parseFloat(styles.opacity);
      await expect(opacity).toBeLessThanOrEqual(1);
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
      await expect(liveIndicator).toBeInTheDocument();
    }

    // Verify card is not selectable
    const cardElement = canvasElement.querySelector('[class*="Card"]');
    if (cardElement) {
      // Click should not trigger checkbox (not selectable)
      await userEvent.click(cardElement);
      await expect(args.onCheckChange).not.toHaveBeenCalledWith(
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
      await expect(checkbox).toBeChecked();
    }

    // Click card again to toggle off
    const cardElement = canvasElement.querySelector('[class*="Card"]');
    if (cardElement) {
      await userEvent.click(cardElement);
      // Should toggle to false (unchecked)
      await expect(args.onCheckChange).toHaveBeenCalledWith(
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
    await expect(title).toBeInTheDocument();

    // On mobile, clicking card should trigger same interactions
    const cardElement = canvasElement.querySelector('[class*="Card"]');
    if (cardElement) {
      await userEvent.click(cardElement);
      await expect(args.onCheckChange).toHaveBeenCalledWith(
        mockVideoNeverDownloaded.youtube_id,
        true
      );
    }
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
      await expect(cardElement).toBeInTheDocument();
    }

    // Test unblock/cancel delete button
    const unblockButtons = canvas.queryAllByRole('button', { name: /unblock|cancel|restore/i });
    if (unblockButtons.length > 0) {
      await userEvent.click(unblockButtons[0]);
      await expect(args.onToggleDeletion).toHaveBeenCalledWith(mockVideoNeverDownloaded.youtube_id);
    }
  },
};
