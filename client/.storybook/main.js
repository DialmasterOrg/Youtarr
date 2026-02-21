import { mergeConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const config = {
  stories: [
    '../src/**/__tests__/**/*.story.@(js|jsx|mjs|ts|tsx|mdx)',
  ],
  addons: ['@storybook/addon-a11y', '@storybook/addon-links'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  async viteFinal(config) {
    return mergeConfig(config, {
      plugins: [tsconfigPaths()],
      define: {
        ...(config.define ?? {}),
        'process.env': {},
      },
      envPrefix: ['VITE_', 'REACT_APP_'],
    });
  },
};

export default config;