<template>
  <div class="flex flex-col h-screen">
    <div class="bg-white w-screen h-auto z-10">
      <div class="mx-4 my-4">
        <AppLogo />
      </div>
    </div>
    <div class="flex flex-grow mx-4">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppLogo from '@/components/AppLogo.vue';
</script>
