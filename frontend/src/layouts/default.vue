<template>
  <div class="flex flex-col h-[100svh] px-4 pb-4">
    <app-header />
    <div
      v-if="showPostLoginLoader"
      class="flex grow flex-col items-center justify-center gap-3"
    >
      <ProgressSpinner />
      <span class="text-sm text-surface-500">Loading...</span>
    </div>
    <slot v-else />
  </div>
</template>

<script setup lang="ts">
const $user = useSupabaseUser();
const $route = useRoute();

const showPostLoginLoader = computed(
  () => Boolean($user.value) && $route.path.startsWith('/auth'),
);
</script>
