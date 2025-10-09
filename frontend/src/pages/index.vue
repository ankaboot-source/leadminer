<template>
  <div></div>
</template>

<script setup lang="ts">
import { navigateTo, onMounted, useRoute } from '#imports';
import { useToast } from 'primevue/usetoast';
import { computed } from 'vue';

const $supabase = useSupabaseClient();
const $toast = useToast();
const $route = useRoute();

function parseHashQuery(hash: string) {
  const hashQuery = hash.startsWith('#') ? hash.substring(1) : hash;
  const queryParams = new URLSearchParams(hashQuery);
  return {
    error: queryParams.get('error'),
    error_description: queryParams.get('error_description'),
    error_code: queryParams.get('error_code'),
  };
}

const authError = computed(() => ({
  ...parseHashQuery($route.hash),
  ...$route.query,
}));

onMounted(async () => {
  const { session } = (await $supabase.auth.getSession()).data;

  const { error } = authError.value;
  if (error) {
    console.error(authError.value);
    $toast.add({
      severity: 'error',
      summary: 'Oops!',
      detail: 'Timeout, please try again',
      life: 3000,
    });
  }

  if (!session) {
    return navigateTo('/auth/login');
  }

  const $contactsStore = useContactsStore();
  await $contactsStore.reloadContacts();
  const homePath = $contactsStore.contactCount ? '/contacts' : '/mine';
  navigateTo(homePath);
});
</script>
