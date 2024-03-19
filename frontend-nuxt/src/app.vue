<template>
  <NuxtPage />
  <Toast />
</template>

<script setup lang="ts">
import { useLeadminerStore } from './stores/leadminer';

const SKIP_DASHBOARD_REDIRECT = ['/oauth-consent-error', '/account'];
const $router = useRouter();
const $store = useLeadminerStore();

useSupabaseClient().auth.onAuthStateChange((event) => {
  if (
    event === 'SIGNED_IN' &&
    !SKIP_DASHBOARD_REDIRECT.includes($router.currentRoute.value.path)
  ) {
    $router.push('/dashboard');
  }

  if (event === 'SIGNED_OUT') {
    $router.push('/auth/login');
    $store.$reset();
  }
});

onNuxtReady(() => {
  // Adds posthog script tag
  const { POSTHOG_INSTANCE_ADDRESS, POSTHOG_API_KEY } =
    useRuntimeConfig().public;
  if (POSTHOG_API_KEY && POSTHOG_INSTANCE_ADDRESS) {
    const customScript = document.createElement('script');
    customScript.textContent = `
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init('${POSTHOG_API_KEY}', {api_host: '${POSTHOG_INSTANCE_ADDRESS}'})`;
    document.head.appendChild(customScript);
  }
});
</script>
./src/stores/leadminer./src/stores/leadminer./src/stores/leadminer
