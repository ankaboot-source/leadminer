<template>
  <div />
</template>

<script setup lang="ts">
const $route = useRoute();
const token = $route.params.token as string;
const config = useRuntimeConfig();

const edgeFunctionUrl = `${config.public.SAAS_SUPABASE_PROJECT_URL}/functions/v1/email-campaigns`;

await navigateTo(`${edgeFunctionUrl}/track/click/${token}`, {
  external: true,
  redirectCode: 302,
});
</script>
