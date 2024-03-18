// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  $development: {
    devtools: { enabled: true },
    sourcemap: {
      server: true,
      client: true,
    },
  },
  srcDir: 'src',
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/supabase',
    'nuxt-primevue',
    '@pinia/nuxt',
    'nuxt-quasar-ui',
    '@nuxtjs/eslint-module',
  ],
  css: [
    'primevue/resources/themes/aura-light-amber/theme.css',
    '~/assets/css/app.scss',
  ],
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
    sassVariables: '~/assets/css/quasar.variables.scss',
    extras: {
      fontIcons: ['material-icons', 'mdi-v5', 'fontawesome-v5'],
    },
  },
  primevue: {
    cssLayerOrder: 'tailwind-base, primevue, tailwind-utilities',
    components: {
      exclude: ['Editor', 'Chart'],
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
});
