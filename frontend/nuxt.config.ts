// https://nuxt.com/docs/api/configuration/nuxt-config
import Aura from '@primeuix/themes/aura';
import pkg from './package.json';

export default defineNuxtConfig({
  srcDir: 'src',

  imports: {
    autoImport: true,
    dirs: ['stores'],
    imports: [
      {
        from: 'primevue/usetoast',
        name: 'useToast',
      },
    ],
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
      CAMPAIGN_COMPLIANCE_FOOTER: process.env.CAMPAIGN_COMPLIANCE_FOOTER,
      IMAGE_REVERSE_PROXY: process.env.IMAGE_REVERSE_PROXY,
      // Nominatim
      NOMINATIM_URL: process.env.NOMINATIM_URL,
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
    '@vite-pwa/nuxt',
  ],

  primevue: {
    options: {
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: 'light',
          cssLayer: {
            name: 'primevue',
            order: 'theme, base, primevue',
          },
        },
      },
    },
    components: {
      exclude: ['Chart'],
    },
  },

  i18n: {
    locales: ['en', 'fr'],
    defaultLocale: 'en',
    strategy: 'no_prefix',
    vueI18n: '../i18n.config.ts', // if you are using custom path, default
    detectBrowserLanguage: {
      useCookie: true,
      cookieSecure: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root', // recommended
    },
  },

  postcss: {
    plugins: {
      '@tailwindcss/postcss': {},
      autoprefixer: {},
    },
  },

  vite: {
    resolve: {
      alias: {
        cookie: 'cookie-es',
      },
    },
    optimizeDeps: {
      include: [
        '@supabase/ssr',
        'cookie',
        'quill',
        'quill-delta',
        'parchment',
        'eventemitter3',
        'lodash-es',
      ],
    },
    ssr: {
      noExternal: ['quill', 'quill-delta', 'parchment'],
    },
  },

  css: ['~/assets/css/tailwind.css'],

  supabase: {
    url: process.env.SUPABASE_PROJECT_URL,
    key: process.env.SUPABASE_ANON_KEY,
    clientOptions: {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    },
    redirectOptions: {
      callback: '/callback',
      login: '/auth/login',
      include: [
        '/mine',
        '/contacts',
        '/sources',
        '/campaigns',
        '/account(/*)?',
      ],
      exclude: ['/auth(/*)?', '/credits-success', '/unsubscribe(/*)?'],
    },
  },

  security: {
    enabled: false,
  },

  pwa: {
    registerType: 'autoUpdate',
    workbox: {
      navigateFallback: undefined,
      runtimeCaching: [],
      skipWaiting: true,
      clientsClaim: true,
    },
    injectRegister: 'auto',
    manifest: {
      id: 'leadminer',
      name: 'Leadminer',
      short_name: 'Leadminer',
      description:
        'Extract, clean and enrich email addresses from your own mailbox.',
      categories: ['business'],
      theme_color: '#ffffff',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'any',
      icons: [
        {
          src: 'icons/pickaxe-192-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: 'icons/pickaxe-512-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: 'icons/pickaxe-512-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
  },

  compatibilityDate: '2024-08-26',
});
