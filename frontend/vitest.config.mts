import { defineVitestConfig } from '@nuxt/test-utils/config';

export default defineVitestConfig({
  test: {
    environment: 'jsdom',
    server: {
      deps: {
        inline: ['@primeuix/themes', '@primeuix/utils'],
      },
    },
  },
});
