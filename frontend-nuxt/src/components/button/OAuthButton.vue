<template>
  <Button
    :icon="icon"
    :label="label"
    outlined
    size="large"
    severity="secondary"
    @click="loginWithOAuth(source)"
  />
</template>

<script setup lang="ts">
import type { Provider } from '@supabase/supabase-js';
import { ref } from 'vue';
import Button from '@/components/button/ButtonComponent.vue';

const supabase = useSupabaseClient();

const { label, icon, source } = defineProps<{
  label: string;
  icon: string;
  size: 'large' | 'small';
  source: Provider;
  align?: 'left' | 'right' | 'center' | 'around' | 'between' | 'evenly';
}>();

const isLoading = ref(false);

async function loginWithOAuth(provider: Provider) {
  isLoading.value = true;
  try {
    const { error } = await supabase.auth.signInWithOAuth({
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
  } catch (error) {
    if (error instanceof Error) {
      throw Error(error.message);
    }
  } finally {
    isLoading.value = false;
  }
}
</script>
