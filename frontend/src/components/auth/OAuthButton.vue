<template>
  <Button
    :icon="icon"
    :label="label"
    outlined
    size="large"
    severity="secondary"
    @click="loginWithOAuth(source)"
  >
    <slot />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button';
import type { Provider } from '@supabase/supabase-js';
import { ref } from 'vue';
import { signInWithOAuth } from '~/utils/auth';

const { label, icon, source } = defineProps<{
  label: string;
  icon: string;
  source: Provider;
}>();

const isLoading = ref(false);

async function loginWithOAuth(provider: Provider) {
  isLoading.value = true;
  try {
    await signInWithOAuth(provider);
  } catch (error) {
    if (error instanceof Error) {
      throw Error(error.message);
    }
  } finally {
    isLoading.value = false;
  }
}
</script>
