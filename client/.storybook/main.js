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
        // Explicitly define NODE_ENV rather than wiping all of process.env,
        // which would conflict with envPrefix env-var injection.
        'process.env.NODE_ENV': JSON.stringify('development'),
      },
      envPrefix: ['VITE_', 'REACT_APP_'],
    });
  },
};

export default config;
