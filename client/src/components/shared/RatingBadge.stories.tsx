import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import RatingBadge from './RatingBadge';

const meta: Meta<typeof RatingBadge> = {
  title: 'Shared/RatingBadge',
  component: RatingBadge,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    size: { control: 'select', options: ['small', 'medium'] },
    variant: { control: 'select', options: ['pill', 'text'] },
    showNA: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof RatingBadge>;

// ─── Common Ratings ──────────────────────────────────────────────────────────
export const Rated_G: Story = { args: { rating: 'G', ratingSource: 'MPAA' } };
export const Rated_PG: Story = { args: { rating: 'PG', ratingSource: 'MPAA' } };
export const Rated_PG13: Story = { args: { rating: 'PG-13', ratingSource: 'MPAA' } };
export const Rated_R: Story = { args: { rating: 'R', ratingSource: 'MPAA' } };
export const Rated_NC17: Story = { args: { rating: 'NC-17', ratingSource: 'MPAA' } };

// ─── TV Ratings ───────────────────────────────────────────────────────────────
export const TV_Y: Story = { args: { rating: 'TV-Y' } };
export const TV_PG: Story = { args: { rating: 'TV-PG' } };
export const TV_14: Story = { args: { rating: 'TV-14' } };
export const TV_MA: Story = { args: { rating: 'TV-MA' } };

// ─── Null / Unrated states ────────────────────────────────────────────────────
export const Unrated: Story = { args: { rating: null, showNA: true } };
export const Hidden: Story = {
  args: { rating: null, showNA: false },
  render: (args) => (
    <div className="text-sm text-muted-foreground">
      No badge rendered when rating=null and showNA=false: &nbsp;
      <RatingBadge {...args} />
      (nothing)
    </div>
  ),
};

// ─── Sizes ───────────────────────────────────────────────────────────────────
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <RatingBadge rating="PG-13" size="small" />
      <RatingBadge rating="PG-13" size="medium" />
    </div>
  ),
};

// ─── Full Rating Scale ────────────────────────────────────────────────────────
export const AllRatings: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'].map((r) => (
        <RatingBadge key={r} rating={r} />
      ))}
    </div>
  ),
};
