import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx|mdx)',
  ],
  addons: ['@storybook/addon-a11y', '@storybook/addon-links'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  async viteFinal(config) {
    return {
      ...config,
      define: {
        ...(config.define ?? {}),
        'process.env': {},
      },
    };
  },
};

export default config;
