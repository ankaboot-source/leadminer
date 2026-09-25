<template>
  <MiningTable
    :show-table="true"
    origin="contacts"
    :contacts="$contactsStore.contactsList"
    :loading="loading"
  />
</template>

<script setup lang="ts">
import { useContactsTableData } from '~/composables/useTableData';

const $contactsStore = useContactsStore();
const { loading } = useContactsTableData();
</script>
