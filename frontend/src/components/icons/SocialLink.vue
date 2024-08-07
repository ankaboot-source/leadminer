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
      class="text-md md:text-xl"
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
  const match = url.match(/\.?(twitter|linkedin|facebook|instagram|x)\./)?.[1];

  if (match === 'x') {
    return 'twitter';
  }

  return match ?? 'globe';
}
</script>
