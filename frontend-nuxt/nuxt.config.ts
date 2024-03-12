// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [
    "@nuxt/test-utils/module",
    "@nuxtjs/i18n",
    "@nuxtjs/supabase",
    "@nuxtjs/tailwindcss",
    "nuxt-primevue",
  ],
  i18n: {
    locales: ["en", "fr"],
    defaultLocale: "en"
  },
  supabase: {
    redirect: false,
  },
  primevue: {
    cssLayerOrder: "tailwind-base, primevue, tailwind-utilities",
    components: {
      exclude: ["Editor", "Chart"],
    },
  },
  css: ["primevue/resources/themes/aura-light-indigo/theme.css"],
});
