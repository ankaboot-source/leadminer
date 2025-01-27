<template>
  <Button
    id="remove-contact"
    v-tooltip.top="
      !isRemoveDisabled && t('remove_contacts', contactsToDeleteLength)
    "
    icon="pi pi-times"
    :label="$screenStore.size.md ? t('remove') : undefined"
    severity="danger"
    outlined
    :disabled="isRemoveDisabled"
    :loading="isRemovingContacts"
    @click="showWarning()"
  />
  <!-- Warning modal Section -->
  <Dialog
    v-model:visible="showRemoveContactModal"
    modal
    :header="t('remove_contacts', contactsToDeleteLength)"
    :style="{ width: '25rem' }"
  >
    <span class="p-text-secondary block mb-5">
      {{ t('remove_contacts_confirmation', contactsToDeleteLength) }}
    </span>
    <div class="flex flex-row-reverse justify-content-start gap-2">
      <Button
        id="remove-contact-confirm"
        type="button"
        :label="t('remove')"
        severity="danger"
        :loading="isRemovingContacts"
        @click="removeContacts()"
      >
      </Button>
      <Button
        type="button"
        :label="$t('common.cancel')"
        severity="secondary"
        @click="closeWarning"
      >
      </Button>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
const $toast = useToast();
const { t } = useI18n({
  useScope: 'local',
});
const $screenStore = useScreenStore();
const props = defineProps<{
  contactsToDelete?: string[];
  contactsToDeleteLength: number;
  isRemoveDisabled: boolean;
  deselectContacts: () => void;
}>();

const { deselectContacts } = props;

const contactsToDelete = computed(() => props.contactsToDelete);
const contactsToDeleteLength = computed(() => props.contactsToDeleteLength);
const isRemovingContacts = ref(false);
const isRemoveDisabled = computed(
  () => props.isRemoveDisabled || isRemovingContacts.value,
);

const showRemoveContactModal = ref(false);

function showWarning() {
  showRemoveContactModal.value = true;
}
function closeWarning() {
  showRemoveContactModal.value = false;
}

async function removeContacts() {
  isRemovingContacts.value = true;
  try {
    await removeContactsFromDatabase(contactsToDelete.value);
    $toast.add({
      severity: 'success',
      summary: t('contacts_removed', contactsToDeleteLength.value),
      detail: t('contacts_removed_success', contactsToDeleteLength.value),
      life: 3000,
    });
    closeWarning();
    deselectContacts();
    isRemovingContacts.value = false;
  } catch (err) {
    isRemovingContacts.value = false;
    throw err;
  }
}
</script>

<i18n lang="json">
{
  "en": {
    "remove": "Remove",
    "remove_contacts_confirmation": "Removing this contact is permanent. You will lose all data related to this contact.| Removing these {n} contacts is permanent. You will lose all data related to these contacts.",
    "remove_contacts": "Remove contact|Remove {n} contacts",
    "contacts_removed": "Contact removed|Contacts removed",
    "contacts_removed_success": "Contact has been removed successfully.| {n} contacts have been removed successfully."
  },
  "fr": {
    "remove": "Supprimer",
    "remove_contacts_confirmation": "La suppression de ce contact est permanente. Vous perdrez toutes les données liées à ce contact.| La suppression de ces {n} contacts est permanente. Vous perdrez toutes les données liées à ces contacts.",
    "remove_contacts": "Supprimer le contact|Supprimer {n} contacts",
    "contacts_removed": "Contact supprimé|Contacts supprimés",
    "contacts_removed_success": "Le contact a été supprimé avec succès.| {n} contacts ont été supprimés avec succès."
  }
}
</i18n>
