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

const $supabase = useSupabaseClient();

const { label, icon, source } = defineProps<{
  label: string;
  icon: string;
  source: Provider;
}>();

const isLoading = ref(false);

async function loginWithOAuth(provider: Provider) {
  isLoading.value = true;
  try {
    const { error } = await $supabase.auth.signInWithOAuth({
      provider,
      options: {
        skipBrowserRedirect: false,
        scopes:
          provider === 'azure'
            ? 'https://outlook.office.com/IMAP.AccessAsUser.All'
            : 'https://mail.google.com/',

        queryParams: {
          prompt: 'select_account',
        },
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
