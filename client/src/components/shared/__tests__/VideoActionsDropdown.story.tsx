import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within, waitFor } from 'storybook/test';
import VideoActionsDropdown from '../VideoActionsDropdown';

const meta: Meta<typeof VideoActionsDropdown> = {
  title: 'Atomic/Shared/VideoActionsDropdown',
  component: VideoActionsDropdown,
  args: {
    selectedVideosCount: 3,
    onContentRating: fn(),
    onDelete: fn(),
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof VideoActionsDropdown>;

export const DefaultWithVideosSelected: Story = {
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    // Verify button is enabled and shows count
    const button = body.getByRole('button', { name: /Actions \(3\)/i });
    await expect(button).toBeInTheDocument();
    await expect(button).toBeEnabled();
  },
};

export const SingleVideoSelected: Story = {
  args: {
    selectedVideosCount: 1,
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    // Verify button shows singular form
    const button = body.getByRole('button', { name: /Actions \(1\)/i });
    await expect(button).toBeInTheDocument();
    await expect(button).toBeEnabled();

    // Verify aria-label uses singular
    const ariaLabel = button.getAttribute('aria-label');
    await expect(ariaLabel).toContain('1 selected video');
  },
};

export const NoVideosSelected: Story = {
  args: {
    selectedVideosCount: 0,
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    // Button should be disabled when no videos selected
    const button = body.getByRole('button', { name: /Actions \(0\)/i });
    await expect(button).toBeDisabled();
  },
};

export const DisabledProp: Story = {
  args: {
    disabled: true,
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    // Button should be disabled with disabled prop
    const button = body.getByRole('button', { name: /Actions/i });
    await expect(button).toBeDisabled();
  },
};

export const OpenMenuActions: Story = {
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    // Menu should not be visible initially
    await expect(body.queryByText('Update Content Rating')).not.toBeInTheDocument();

    // Click button to open menu
    const button = body.getByRole('button', { name: /Actions/i });
    await userEvent.click(button);

    // Verify menu items are visible
    await waitFor(() => {
      expect(body.getByText('Update Content Rating')).toBeInTheDocument();
    });

    // Verify second menu item
    await expect(body.getByText('Delete Selected')).toBeInTheDocument();

    // Verify icons are present
    await expect(body.getByTestId('EighteenUpRatingIcon')).toBeInTheDocument();
    await expect(body.getByTestId('DeleteIcon')).toBeInTheDocument();
  },
};

export const ClickUpdateContentRating: Story = {
  play: async ({ canvasElement, args }: { canvasElement: HTMLElement; args: any }) => {
    const body = within(canvasElement.ownerDocument.body);

    // Click button to open menu
    const button = body.getByRole('button', { name: /Actions/i });
    await userEvent.click(button);

    // Wait for menu item to be visible
    await waitFor(() => {
      expect(body.getByText('Update Content Rating')).toBeInTheDocument();
    });

    const menuItem = body.getByText('Update Content Rating');
    await userEvent.click(menuItem);

    // Verify callback was called
    await expect(args.onContentRating).toHaveBeenCalledTimes(1);

    // Verify menu is closed after clicking
    await waitFor(() => {
      expect(body.queryByText('Update Content Rating')).not.toBeInTheDocument();
    });
  },
};

export const ClickDeleteSelected: Story = {
  play: async ({ canvasElement, args }: { canvasElement: HTMLElement; args: any }) => {
    const body = within(canvasElement.ownerDocument.body);

    // Click button to open menu
    const button = body.getByRole('button', { name: /Actions/i });
    await userEvent.click(button);

    // Wait for "Delete Selected" menu item to be visible
    await waitFor(() => {
      expect(body.getByText('Delete Selected')).toBeInTheDocument();
    });

    const menuItem = body.getByText('Delete Selected');
    await userEvent.click(menuItem);

    // Verify callback was called
    await expect(args.onDelete).toHaveBeenCalledTimes(1);

    // Verify menu is closed after clicking
    await waitFor(() => {
      expect(body.queryByText('Delete Selected')).not.toBeInTheDocument();
    });
  },
};

export const MenuAccessibility: Story = {
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    // Verify button has proper accessibility attributes
    const button = body.getByRole('button', { name: /Actions/i });
    await expect(button).toHaveAttribute('aria-haspopup', 'true');
    await expect(button).toHaveAttribute('aria-expanded', 'false');

    // Open menu and verify aria-expanded changes
    await userEvent.click(button);

    await waitFor(() => {
      expect(button.getAttribute('aria-expanded')).toBe('true');
    });
  },
};
