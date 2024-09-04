import { defineVitestConfig } from '@nuxt/test-utils/config';

export default defineVitestConfig({
  // any custom Vitest config you require
  test: {
    coverage: {
      reporter: [['lcov', { projectRoot: './src' }], ['text']],
    },
  },
});
