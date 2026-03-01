<template>
  <div class="m-auto text-center flex flex-col space-y-6 max-w-[30rem]">
    <div>
      <div class="inline-flex p-3">
        <span class="material-symbols-outlined text-7xl text-orange-400"
          >unsubscribe</span
        >
      </div>
      <div class="text-4xl font-bold font-serif">
        {{ $t('unsubscribe.success_header') }}
      </div>
    </div>
    <div>
      <p>
        {{ $t('unsubscribe.success_message') }}
      </p>
    </div>
    <div v-if="isPreview" class="bg-blue-50 border border-blue-200 rounded p-4">
      <p class="text-sm text-blue-800">
        {{ $t('unsubscribe.preview_notice') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const $route = useRoute();
const isPreview = Boolean($route.query.preview);
</script>
