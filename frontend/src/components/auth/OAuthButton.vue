<template>
  <Button
    :id="`${authMode}-social-${source}`"
    :icon="icon"
    :label="label"
    outlined
    size="large"
    severity="secondary"
    @click="signIn(source)"
  >
    <slot />
  </Button>
</template>

<script setup lang="ts">
import type { authModes } from '@/types/auth';
import type { Provider } from '@supabase/supabase-js';
import Button from 'primevue/button';
import { ref } from 'vue';
import { signInWithOAuth } from '~/utils/auth';

const { label, icon, source } = defineProps<{
  label: string;
  icon: string;
  source: Provider;
  authMode: authModes;
}>();

const isLoading = ref(false);

async function signIn(provider: Provider) {
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
