<template>
  <template v-if="showPhones">
    <i
      v-for="(phone, index) in phones"
      :key="index"
      v-tooltip="{
        value: phone,
        class: 'text-xs ml-1',
      }"
      class="pi pi-phone cursor-pointer hover:text-primary mx-1 transition-colors"
      @click="callPhoneNumber(phone)"
    />
  </template>

  <template v-if="showSocialLinks">
    <i
      v-for="(link, index) in socialLinks"
      :key="index"
      v-tooltip="{
        value: link,
        class: 'text-xs ml-1',
      }"
      class="cursor-pointer hover:text-primary mx-1 transition-colors"
      :class="`pi pi-${getSameAsIcon(link)}`"
      @click="openLink(link)"
    />
  </template>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    socialLinks?: string[] | null;
    phones?: string[] | null;
    showSocialLinks?: boolean;
    showPhones?: boolean;
    small?: boolean;
  }>(),
  {
    socialLinks: () => [],
    phones: () => [],
    showSocialLinks: true,
    showPhones: true,
    small: false,
  },
);

const socialLinks = computed(() =>
  props.small ? props.socialLinks?.slice(0, 3) : props.socialLinks,
);

function getSameAsIcon(url: string) {
  try {
    const domainArray = new URL(url).hostname.split('.');
    const domain = domainArray.length > 2 ? domainArray[1] : domainArray[0];
    const match = domain?.match(
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

function openLink(url: string) {
  window.open(url, '_blank');
}
</script>
