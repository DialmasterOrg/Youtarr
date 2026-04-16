import type { FC } from 'react';
import LocalLogin from './LocalLogin';

const meta = {
  title: 'Auth/LocalLogin',
  component: LocalLogin,
  tags: ['autodocs'],
  args: {
    setToken: () => {},
  },
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story: FC) => (
      <div className="w-[360px] rounded-lg bg-[var(--app-bg-surface)] p-6 shadow-sm">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = {
  play?: (args: { canvasElement: HTMLElement }) => Promise<void>;
};

export const Default: Story = {};

export const WithErrorState: Story = {
  play: async ({ canvasElement }) => {
    const form = canvasElement.querySelector('form');
    if (!form) {
      throw new Error('Login form not rendered');
    }
  },
};
