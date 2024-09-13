<template>
  <div class="flex flex-col grow">
    <mining-stepper :collapsed="contact.length > 0" />
    <mining-table :table-data="contact" />
  </div>
</template>
<script setup lang="ts">
import { type Contact } from '~/types/contact';

const $user = useSupabaseUser();

const contact = ref<Contact[]>([]);

if ($user.value) {
  contact.value = await getContacts($user.value.id);
}
</script>
