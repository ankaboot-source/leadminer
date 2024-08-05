<template>
  <NuxtLink
    v-for="(link, index) in socialLinks"
    :key="index"
    :to="link"
    target="_blank"
    rel="noopener"
  >
    <i
      v-tooltip.right="{
        value: link,
        class: 'text-xs ml-1',
      }"
      :class="`pi pi-${getSameAsIcon(link)}`"
      class="text-xl"
    />
  </NuxtLink>
</template>
<script setup lang="ts">
const { socialLinks } = defineProps<{
  socialLinks: string[];
}>();

function getSameAsIcon(url: string) {
  const domain = url
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .split('/')[0];
  const match = domain.match(
    /^(twitter|x|linkedin|facebook|instagram)(?:\.com)?$/
  );

  if (match) {
    // Special case for 'x.com'
    if (match[1] === 'x') {
      return 'twitter';
    }
    return match[1];
  }
  return 'globe';
}
</script>
