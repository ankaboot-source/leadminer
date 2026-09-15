<template>
  <div class="flex flex-col h-[100svh] px-4 pb-4">
    <app-header />
    <div class="relative flex grow flex-col">
      <!-- Overlay instead of v-if/v-else: unmounting the page outlet while a
           post-login navigation is in flight orphans NuxtPage's Suspense, so
           Nuxt never syncs its rendered route and the app freezes on the
           loader. The outlet stays mounted; the loader simply covers it. -->
      <div
        v-if="showPostLoginLoader"
        class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white"
      >
        <ProgressSpinner />
        <span class="text-sm text-surface-500">Loading...</span>
      </div>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
const $user = useSupabaseUser();
const $route = useRoute();

const showPostLoginLoader = computed(
  () => Boolean($user.value) && $route.path.startsWith('/auth'),
);
</script>
