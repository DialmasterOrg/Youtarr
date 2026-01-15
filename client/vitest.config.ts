import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [{ extends: './vitest.unit.config.ts' }, { extends: './vitest.storybook.config.ts' }],
  },
});
