import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within, waitFor } from 'storybook/test';
import ChangeRatingDialog from '../ChangeRatingDialog';

const meta: Meta<typeof ChangeRatingDialog> = {
  title: 'Atomic/Shared/ChangeRatingDialog',
  component: ChangeRatingDialog,
  args: {
    open: true,
    onClose: fn(),
    onApply: fn().mockResolvedValue(undefined),
    selectedCount: 3,
  },
};

export default meta;
type Story = StoryObj<typeof ChangeRatingDialog>;

export const DialogOpen: Story = {
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('dialog')).toBeInTheDocument();
    await expect(body.getByText(/Content Rating/)).toBeInTheDocument();
  },
};

export const DialogClosed: Story = {
  args: {
    open: false,
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    // Dialog should not be visible
    await expect(body.queryByRole('dialog')).not.toBeInTheDocument();
  },
};

export const SingleVideoSelection: Story = {
  args: {
    selectedCount: 1,
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText(/1/)).toBeInTheDocument();
    // Should show singular "video" not "videos"
    const text = body.getByText((content: string) =>
      content.includes('1') && content.includes('video') && !content.includes('videos')
    );
    await expect(text).toBeInTheDocument();
  },
};

export const MultipleVideosSelection: Story = {
  args: {
    selectedCount: 5,
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText(/5/)).toBeInTheDocument();
    await expect(body.getByText(/videos/)).toBeInTheDocument();
  },
};

export const SelectRatingAndApply: Story = {
  play: async ({ canvasElement, args }: { canvasElement: HTMLElement; args: any }) => {
    const body = within(canvasElement.ownerDocument.body);

    // Verify dialog is open
    await expect(body.getByRole('dialog')).toBeInTheDocument();

    // Find and click the select dropdown
    const selectButton = body.getByRole('combobox');
    await userEvent.click(selectButton);

    await waitFor(() => {
      expect(body.getByRole('option', { name: /R/ })).toBeInTheDocument();
    });

    // Click the R rating option
    const rOption = body.getByRole('option', { name: /R/ });
    await userEvent.click(rOption);

    // Verify the selection was made (select shows the value)
    await waitFor(() => {
      expect(body.getByRole('combobox')).toHaveValue('R');
    });

    // Click Apply
    const applyButton = body.getByRole('button', { name: /Apply/i });
    await userEvent.click(applyButton);

    // Verify onApply was called with the selected rating
    await waitFor(() => {
      expect(args.onApply).toHaveBeenCalledWith('R');
    });
  },
};

export const ClearRatingWithNR: Story = {
  play: async ({ canvasElement, args }: { canvasElement: HTMLElement; args: any }) => {
    const body = within(canvasElement.ownerDocument.body);

    // NR is the default value, so we can directly click Apply
    const applyButton = body.getByRole('button', { name: /Apply/i });
    await userEvent.click(applyButton);

    // onApply should be called with null for NR
    await waitFor(() => {
      expect(args.onApply).toHaveBeenCalledWith(null);
    });
  },
};

export const CancelDialog: Story = {
  play: async ({ canvasElement, args }: { canvasElement: HTMLElement; args: any }) => {
    const body = within(canvasElement.ownerDocument.body);

    // Click Cancel
    const cancelButton = body.getByRole('button', { name: /Cancel/i });
    await userEvent.click(cancelButton);

    // onClose should be called
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const LoadingState: Story = {
  args: {
    onApply: fn(() => new Promise<void>(() => {})), // Never resolves
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    // Click Apply to trigger loading state
    const applyButton = body.getByRole('button', { name: /Apply/i });
    await userEvent.click(applyButton);

    // Wait for loading spinner to appear
    await waitFor(() => {
      expect(body.getByRole('progressbar')).toBeInTheDocument();
    });

    // Verify Cancel button is disabled during loading
    const cancelButton = body.getByRole('button', { name: /Cancel/i });
    await expect(cancelButton).toBeDisabled();
  },
};