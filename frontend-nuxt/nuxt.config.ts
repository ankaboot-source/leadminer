// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  $development: {
    devtools: { enabled: true },
    sourcemap: {
      server: true,
      client: true,
    },
    devServer: {
      port: 8082,
    },
  },
  srcDir: 'src',
  modules: [
    '@nuxt/test-utils/module',
    '@nuxtjs/eslint-module',
    '@nuxtjs/i18n',
    '@nuxtjs/supabase',
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    'nuxt-primevue',
    'nuxt-quasar-ui',
  ],
  primevue: {
    cssLayerOrder: 'tailwind-base, primevue, tailwind-utilities',
    components: {
      exclude: ['Editor', 'Chart'],
    },
  },
  css: [
    'primevue/resources/themes/aura-light-indigo/theme.css',
    'primeicons/primeicons.css',
    '~/assets/css/app.scss',
  ],
  i18n: {
    locales: ['en', 'fr'],
    defaultLocale: 'en',
  },
  postcss: {
    plugins: {
      autoprefixer: {
        overrideBrowserslist: [
          'last 4 Chrome versions',
          'last 4 Firefox versions',
          'last 4 Edge versions',
          'last 4 Safari versions',
          'last 4 Android versions',
          'last 4 ChromeAndroid versions',
          'last 4 FirefoxAndroid versions',
          'last 4 iOS versions',
        ],
      },
    },
  },
  quasar: {
    plugins: ['Notify'],
    extras: {
      fontIcons: ['material-icons'],
    },
  },
  supabase: {
    url: process.env.SUPABASE_PROJECT_URL,
    key: process.env.SUPABASE_ANON_KEY,
    redirectOptions: {
      login: '/auth/login',
      callback: '/callback',
      include: undefined,
      exclude: ['/auth/signup', '/auth/forgot-password'],
      cookieRedirect: false,
    },
  },
  runtimeConfig: {
    public: {
      SERVER_ENDPOINT: process.env.SERVER_ENDPOINT,
      // Analytics
      POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
      POSTHOG_INSTANCE_ADDRESS: process.env.POSTHOG_INSTANCE_ADDRESS,
      // UI
      AVERAGE_EXTRACTION_RATE: process.env.AVERAGE_EXTRACTION_RATE,
      // Credits
      ENABLE_CREDIT: process.env.ENABLE_CREDIT,
      EXTERNAL_REFILL_CREDITS_LINK: process.env.EXTERNAL_REFILL_CREDITS_LINK,
    },
  },
  imports: {
    autoImport: true,
  },
});
