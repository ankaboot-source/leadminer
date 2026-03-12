<template>
  <div />
</template>

<script setup lang="ts">
const $route = useRoute();
const token = $route.params.token as string;
const sender = $route.query.sender as string | undefined;
const config = useRuntimeConfig();

const edgeFunctionUrl = `${config.public.SAAS_SUPABASE_PROJECT_URL}/functions/v1/email-campaigns`;
const targetUrl = `${edgeFunctionUrl}/unsubscribe/${encodeURIComponent(token)}${sender ? `?sender=${encodeURIComponent(sender)}` : ''}`;

await navigateTo(targetUrl, {
  external: true,
  redirectCode: 302,
});
</script>
