// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ["@nuxtjs/tailwindcss", "nuxt-primevue", "@nuxtjs/supabase"],
  supabase: {
    redirect: false,
  },
  primevue: {
    cssLayerOrder: "tailwind-base, primevue, tailwind-utilities",
    components: {
      exclude: ["Editor", "Chart"],
    },
  },
  css: [
    "primevue/resources/themes/aura-light-indigo/theme.css",
    "primeicons/primeicons.css",
  ],
  imports: {
    autoImport: true,
  },
});
