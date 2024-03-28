// https://nuxt.com/docs/api/configuration/nuxt-config
import pkg from './package.json';

export default defineNuxtConfig({
  srcDir: 'src',
  imports: {
    autoImport: true,
  },
  eslint: {
    lintOnStart: false,
  },
  $development: {
    devtools: { enabled: true },
    devServer: {
      port: 8082,
    },
    typescript: {
      // Enable after removing quasar
      typeCheck: false,
    },
  },
  app: {
    head: {
      titleTemplate: `${pkg.productName}`,
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
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
  quasar: {
    plugins: ['Notify'],
    sassVariables: '~/assets/css/quasar.variables.scss',
    extras: {
      fontIcons: ['material-icons', 'mdi-v5', 'fontawesome-v5'],
    },
  },
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
  css: [
    'primeicons/primeicons.css',
    '~/assets/css/aura-light-indigo-theme-contrast-amber.css',
    '~/assets/css/app.scss',
  ],
  supabase: {
    url: process.env.SUPABASE_PROJECT_URL,
    key: process.env.SUPABASE_ANON_KEY,
    clientOptions: {
      auth: {
        flowType: 'implicit',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    },
    redirectOptions: {
      callback: '/',
      login: '/auth/login',
      exclude: ['/auth/signup', '/auth/forgot-password'],
    },
  },
});
