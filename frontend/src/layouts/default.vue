<template>
  <div class="px-4">
    <app-header />
    <slot />
  </div>
</template>

<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue';
</script>
