<template>
  <i
    v-if="location && Object.keys(location).length"
    v-tooltip.top="location.display_name"
    class="pi pi-map-marker text-primary-500 cursor-pointer hover:text-primary-600 transition-colors"
    @click="goToLocation()"
  />
</template>

<script setup lang="ts">
import type { NormalizedLocation } from '~/types/contact';

const { location } = defineProps<{
  location: NormalizedLocation | null;
}>();

console.log('location', location);

function goToLocation() {
  if (!location || !location.lat || !location.lon) return;

  window.open(getLocationUrl(location.lat, location.lon), '_blank');
}
</script>
