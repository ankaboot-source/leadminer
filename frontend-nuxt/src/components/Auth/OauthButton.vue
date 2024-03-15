<template>
  <q-btn
    :loading="isLoading"
    no-caps
    unelevated
    :align="align"
    :size="size"
    :icon="icon"
    :label="label"
    @click="loginWithOAuth(source)"
  />
</template>
<script setup lang="ts">
import { type Provider } from '@supabase/supabase-js';
import { ref } from 'vue';

const { label, icon, size, source, align } = defineProps<{
  label: string;
  icon: string;
  size: string;
  source: Provider;
  align: 'left' | 'right' | 'center' | 'around' | 'between' | 'evenly';
}>();

const isLoading = ref(false);

async function loginWithOAuth(provider: Provider) {
  isLoading.value = true;
  try {
    const { error } = await useSupabaseClient().auth.signInWithOAuth({
      provider,
      options: {
        skipBrowserRedirect: false,
        redirectTo: `${window.location.origin}/dashboard`,
        scopes: 'email',
      },
    });
    if (error) {
      throw error;
    }
    isLoading.value = false;
  } catch (err) {
    isLoading.value = false;
    throw err;
  }
}
</script>
