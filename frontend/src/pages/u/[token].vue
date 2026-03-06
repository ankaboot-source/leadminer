<template>
  <div />
</template>

<script setup lang="ts">
const $route = useRoute();
const token = $route.params.token as string;
const sender = $route.query.sender as string | undefined;

const previewModes = ['preview-unsubscribe', 'preview-open', 'preview-click'];

if (previewModes.includes(token)) {
  await navigateTo(`/unsubscribe/success?preview=true`, { external: true });
} else if (sender) {
  await navigateTo(
    `/unsubscribe/success?sender=${encodeURIComponent(sender)}`,
    {
      external: true,
    },
  );
} else {
  await navigateTo(`/unsubscribe/success`, { external: true });
}
</script>
