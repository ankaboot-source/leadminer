// https://nuxt.com/docs/api/configuration/nuxt-config
import pkg from './package.json';

export default defineNuxtConfig({
  srcDir: 'src',

  imports: {
    autoImport: true,
    dirs: ['stores'],
  },

  $development: {
    devtools: { enabled: true },
    devServer: {
      port: 8082,
    },
    typescript: {
      typeCheck: true,
    },
  },

  app: {
    head: {
      titleTemplate: `${pkg.productName}`,
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/icon?family=Material+Icons',
        },
      ],
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
      // Supabase SaaS
      SAAS_SUPABASE_PROJECT_URL: process.env.SAAS_SUPABASE_PROJECT_URL,
      SAAS_SUPABASE_ANON_KEY: process.env.SAAS_SUPABASE_ANON_KEY,
    },
  },

  modules: [
    '@nuxt/test-utils/module',
    '@nuxtjs/supabase',
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    'nuxt-primevue',
    '@nuxtjs/i18n',
  ],

  primevue: {
    cssLayerOrder: 'tailwind-base, primevue, tailwind-utilities',
    components: {
      exclude: ['Editor', 'Chart'],
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
    'primevue/resources/themes/aura-light-indigo/theme.css',
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
      exclude: [
        '/auth/signup',
        '/auth/forgot-password',
        '/auth/success',
        '/credits-success',
        '/account/settings',
      ],
    },
  },
});
