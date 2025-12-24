<template>
  <Button
    outlined
    :icon="icon"
    :label="label"
    @click="addOAuthAccount(source, redirectUri)"
  />
</template>
<script setup lang="ts">
import type { OAuthMiningSource } from '@/types/mining';
import { addOAuthAccount } from '@/utils/oauth';

const { label, icon, source, redirectUri } = defineProps<{
  label: string;
  icon: string;
  source: OAuthMiningSource;
  redirectUri: string;
}>();

console.log(redirectUri);
</script>
