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
      class="text-md md:text-lg lg:text-xl"
    />
  </NuxtLink>
</template>
<script setup lang="ts">
const props = defineProps<{
  socialLinks: string[];
  small: boolean;
}>();

const socialLinks = props.small
  ? props.socialLinks.slice(0, 3)
  : props.socialLinks;

function getSameAsIcon(url: string) {
  try {
    const domain = new URL(url).hostname.split('.')[0];
    const match = domain.match(
      /^(twitter|linkedin|facebook|instagram|x)$/i,
    )?.[0];
    if (match === 'x') {
      return 'twitter';
    }
    return match ?? 'globe';
  } catch {
    return 'globe';
  }
}
</script>
