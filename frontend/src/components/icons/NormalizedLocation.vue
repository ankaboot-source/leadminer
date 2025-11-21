<template>
  <i
    v-if="normalizedLocation && Object.keys(normalizedLocation).length"
    v-tooltip.top="normalizedLocation.display_name"
    class="pi pi-map-marker text-primary-500 cursor-pointer hover:text-primary-600 transition-colors"
    @click="goToLocation()"
  />
</template>

<script setup lang="ts">
import type { NormalizedLocation } from '~/types/contact';

const { normalizedLocation } = defineProps<{
  normalizedLocation: NormalizedLocation | null;
}>();

function goToLocation() {
  if (!normalizedLocation || !normalizedLocation.lat || !normalizedLocation.lon)
    return;

  window.open(
    getLocationUrl(normalizedLocation.lat, normalizedLocation.lon),
    '_blank',
  );
}
</script>
