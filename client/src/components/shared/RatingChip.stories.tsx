import type { Meta, StoryObj } from '@storybook/react';
import RatingChip from './RatingChip';

const meta: Meta<typeof RatingChip> = {
  title: 'Components/Shared/RatingChip',
  component: RatingChip,
  args: {
    rating: 'TV-14',
    size: 'small',
  },
};

export default meta;

type Story = StoryObj<typeof RatingChip>;

const setTheme = (mode: 'playful' | 'neumorphic') => {
  try {
    localStorage.setItem('uiThemeMode', mode);
  } catch (err) {
    // ignore storage issues in storybook
  }
  document.body.dataset.theme = mode;
};

export const Playful: Story = {
  decorators: [
    (Story) => {
      setTheme('playful');
      return <Story />;
    },
  ],
};

export const Neumorphic: Story = {
  decorators: [
    (Story) => {
      setTheme('neumorphic');
      return <Story />;
    },
  ],
  args: {
    rating: 'PG-13',
  },
};
