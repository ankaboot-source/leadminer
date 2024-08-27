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
      typeCheck: true,
    },
    eslint: {
      checker: true,
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
      // Supabase saas
      SAAS_SUPABASE_PROJECT_URL: process.env.SAAS_SUPABASE_PROJECT_URL,
      SAAS_SUPABASE_ANON_KEY: process.env.SAAS_SUPABASE_ANON_KEY,
    },
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/test-utils/module',
    '@nuxtjs/i18n',
    '@nuxtjs/supabase',
    '@pinia/nuxt',
    '@primevue/nuxt-module',
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

  compatibilityDate: '2024-08-26',
});
