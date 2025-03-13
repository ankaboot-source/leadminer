<template>
  <div></div>
</template>
<script setup lang="ts">
const $supabase = useSupabaseClient();
const { session } = (await $supabase.auth.getSession()).data;
const $contactsStore = useContactsStore();
if (session) await $contactsStore.reloadContacts();
const homePath = $contactsStore.contactCount ? '/contacts' : '/mine';
navigateTo(homePath);
</script>
