import { defineNuxtPlugin, useRuntimeConfig } from '#app';
import posthog from 'posthog-js';

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const posthogClient = posthog.init(config.public.POSTHOG_API_KEY, {
    api_host: `${config.public.POSTHOG_INSTANCE_ADDRESS}/ingest`,
    ui_host: config.public.POSTHOG_INSTANCE_ADDRESS,
    disable_cookies: true,
  });
  return {
    provide: {
      posthog: posthogClient,
    },
  };
});
