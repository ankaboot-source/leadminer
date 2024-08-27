<template>
  <Button
    outlined
    :icon="icon"
    :label="label"
    @click="addOAuthAccount(source)"
  />
</template>
<script setup lang="ts">
import type { OAuthMiningSource } from '@/types/mining';
import { addOAuthAccount } from '@/utils/oauth';

const { label, icon, source } = defineProps<{
  label: string;
  icon: string;
  source: OAuthMiningSource;
}>();
</script>
