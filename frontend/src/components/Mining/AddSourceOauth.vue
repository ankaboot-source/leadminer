<template>
  <Button
    outlined
    :icon="icon"
    :label="label"
    class="rounded-none border-black text-slate-700"
    @click="addOAuthAccount(source)"
  />
</template>
<script setup lang="ts">
import { type OAuthMiningSource } from '@/types/mining';
import { addOAuthAccount } from '@/utils/oauth';

const { label, icon, source } = defineProps<{
  label: string;
  icon: string;
  source: OAuthMiningSource;
}>();
</script>
