// https://nuxt.com/docs/api/configuration/nuxt-config
import Aura from '@primevue/themes/aura';
import pkg from './package.json';

export default defineNuxtConfig({
  srcDir: 'src',

  imports: {
    autoImport: true,
    dirs: ['stores'],
  },

  build: {
    analyze: {
      gzipSize: true,
    },
  },

  nitro: {
    compressPublicAssets: true,
  },

  $development: {
    devtools: { enabled: true },
    devServer: {
      port: 8082,
    },
    typescript: {
      typeCheck: false,
    },
    eslint: {
      checker: false,
    },
  },

  app: {
    head: {
      titleTemplate: `${pkg.productName}`,
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
      // Supabase saas
      SAAS_SUPABASE_PROJECT_URL: process.env.SAAS_SUPABASE_PROJECT_URL,
      SAAS_SUPABASE_ANON_KEY: process.env.SAAS_SUPABASE_ANON_KEY,
      IMAGE_PROXY_URL: process.env.IMAGE_PROXY_URL,
    },
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/test-utils/module',
    '@nuxtjs/i18n',
    '@nuxtjs/supabase',
    '@pinia/nuxt',
    '@primevue/nuxt-module',
    'nuxt-mdi',
    'nuxt-security',
    '@nuxt/scripts',
  ],

  primevue: {
    options: {
      theme: {
        preset: Aura,
      },
    },
    components: {
      exclude: ['Editor', 'Chart'],
    },
  },

  i18n: {
    locales: ['en', 'fr'],
    defaultLocale: 'en',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieSecure: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root', // recommended
    },
  },

  postcss: {
    plugins: {
      tailwindcss: {},
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

  css: ['primeicons/primeicons.css', '~/assets/css/tailwind.css'],

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
      callback: '/callback',
      login: '/auth/login',
      include: ['/dashboard', '/account(/*)?'],
      exclude: ['/auth(/*)?', '/credits-success'],
    },
  },

  security: {
    enabled: false,
  },

  compatibilityDate: '2024-08-26',
});
