import { mergeConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    '../src/**/*.stories.@(ts|tsx|js|jsx|mdx)',
    '../src/**/__tests__/**/*.story.@(ts|tsx|js|jsx|mdx)',
  ],
  addons: ['@storybook/addon-a11y', '@storybook/addon-links'],
  staticDirs: ['../public'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  async viteFinal(existingConfig) {
    return mergeConfig(existingConfig, {
      plugins: [tsconfigPaths()],
      define: {
        ...(existingConfig.define ?? {}),
        'process.env.NODE_ENV': JSON.stringify('development'),
      },
      envPrefix: ['VITE_', 'REACT_APP_'],
    });
  },
};

export default config;
