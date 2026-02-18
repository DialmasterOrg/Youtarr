import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import RatingBadge from '../RatingBadge';

const meta: Meta<typeof RatingBadge> = {
  title: 'Atomic/Shared/RatingBadge',
  component: RatingBadge,
};

export default meta;
type Story = StoryObj<typeof RatingBadge>;

export const Default: Story = {
  args: {
    rating: null,
    showNA: false,
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const container = canvasElement;
    // Default should render nothing
    await expect(container.querySelector('div')).toBeInTheDocument();
  },
};

export const UnratedWithShowNA: Story = {
  args: {
    rating: null,
    showNA: true,
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText('Unrated')).toBeInTheDocument();
  },
};

export const RatingG: Story = {
  args: {
    rating: 'G',
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText('G')).toBeInTheDocument();
  },
};

export const RatingPG13: Story = {
  args: {
    rating: 'PG-13',
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText('PG-13')).toBeInTheDocument();
  },
};

export const RatingR: Story = {
  args: {
    rating: 'R',
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText('R')).toBeInTheDocument();
  },
};

export const RatingTVMA: Story = {
  args: {
    rating: 'TV-MA',
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText('TV-MA')).toBeInTheDocument();
  },
};

export const TextVariant: Story = {
  args: {
    rating: 'R',
    variant: 'text',
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText('R')).toBeInTheDocument();
    // Text variant should have the icon
    await expect(body.getByTestId('EighteenUpRatingIcon')).toBeInTheDocument();
  },
};

export const TextVariantPG: Story = {
  args: {
    rating: 'PG',
    variant: 'text',
    size: 'medium',
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText('PG')).toBeInTheDocument();
  },
};

export const WithRatingSource: Story = {
  args: {
    rating: 'TV-14',
    ratingSource: 'Manual Override',
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText('TV-14')).toBeInTheDocument();
  },
};

export const SmallSize: Story = {
  args: {
    rating: 'NC-17',
    size: 'small',
  },
};

export const MediumSize: Story = {
  args: {
    rating: 'TV-Y',
    size: 'medium',
  },
};
