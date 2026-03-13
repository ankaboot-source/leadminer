<template>
  <div class="m-auto text-center flex flex-col space-y-6 max-w-[30rem]">
    <div>
      <div class="inline-flex p-3">
        <i class="pi pi-sign-out !text-7xl !text-orange-400"></i>
      </div>
      <div class="text-4xl font-bold font-serif">
        {{ $t('unsubscribe.success_header') }}
      </div>
    </div>
    <div>
      <p>
        {{ $t('unsubscribe.success_message', { sender: senderEmail }) }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const $route = useRoute();
const senderEmail = $route.query.sender as string | undefined;
</script>
