<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useSmtpSendersStore } from '~/stores/smtp-senders';
import AddEmailSenderDialog from './AddEmailSenderDialog.vue';
import type { SmtpSender } from '@/types/smtp-senders';

const props = withDefaults(
  defineProps<{
    hideEmptyState?: boolean;
  }>(),
  {
    hideEmptyState: false,
  },
);

const { t } = useI18n({ useScope: 'local' });
const { t: globalT } = useI18n({ useScope: 'global' });
const $confirm = useConfirm();
const $toast = useToast();
const $store = useSmtpSendersStore();

const showAddDialog = ref(false);
const editingSender = ref<SmtpSender | null>(null);
const testingSenderId = ref<string | null>(null);

function openAddDialog() {
  editingSender.value = null;
  showAddDialog.value = true;
}

function openEditDialog(sender: SmtpSender) {
  editingSender.value = sender;
  showAddDialog.value = true;
}

async function testSender(sender: SmtpSender) {
  testingSenderId.value = sender.id;

  const result = await $store.testSender(sender.id);

  $toast.add({
    severity: result.success ? 'success' : 'error',
    summary: result.success ? t('test_successful') : t('test_failed'),
    detail: result.message,
    life: 5000,
  });

  testingSenderId.value = null;
}

function confirmDelete(sender: SmtpSender) {
  $confirm.require({
    message: t('delete_confirm_message', { name: sender.name }),
    header: t('delete_confirm_header'),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('delete'),
    rejectLabel: globalT('common.cancel'),
    acceptClass: 'p-button-danger',
    accept: async () => {
      const success = await $store.deleteSender(sender.id);
      if (success) {
        $toast.add({
          severity: 'success',
          summary: t('sender_deleted'),
          life: 3000,
        });
      } else {
        $toast.add({
          severity: 'error',
          summary: t('delete_failed'),
          detail: $store.error || '',
          life: 5000,
        });
      }
    },
  });
}

function getAuthBadge(sender: SmtpSender): string {
  if (sender.auth_type === 'oauth') {
    return sender.oauth_provider === 'google'
      ? 'Google OAuth'
      : 'Microsoft OAuth';
  }
  return 'Password';
}

defineExpose({ openAddDialog });

onMounted(async () => {
  await $store.fetchSenders();
  if ($store.senders.length === 0) {
    await $store.regenerateFromSources();
  }
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      v-if="$store.isLoading && $store.senders.length === 0"
      class="flex justify-center py-8"
    >
      <ProgressSpinner />
    </div>

    <div
      v-else-if="$store.senders.length === 0"
      class="text-center py-8 text-surface-500"
    >
      <p v-if="$store.error" class="text-red-500 mb-2">{{ $store.error }}</p>
      <p v-if="!props.hideEmptyState">{{ t('no_senders_configured') }}</p>
    </div>

    <div v-else class="flex flex-col gap-2">
      <div
        v-for="sender in $store.senders"
        :key="sender.id"
        class="flex items-center justify-between p-4 border border-surface-200 rounded-md"
      >
        <div class="flex items-center gap-3">
          <i class="pi pi-envelope text-lg text-surface-400" />
          <div class="flex flex-col">
            <span class="font-medium">{{ sender.name }}</span>
            <span class="text-sm text-surface-500">{{ sender.email }}</span>
            <span class="text-xs text-surface-400"
              >{{ sender.smtp_host }}:{{ sender.smtp_port }}</span
            >
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Tag :value="getAuthBadge(sender)" severity="info" class="text-xs" />
          <Tag
            v-if="sender.mining_source_email"
            :value="t('linked_to_source')"
            severity="warn"
            class="text-xs"
          />
          <Button
            text
            size="small"
            icon="pi pi-pencil"
            :label="t('edit')"
            @click="openEditDialog(sender)"
          />
          <Button
            text
            size="small"
            icon="pi pi-check-circle"
            :label="t('test')"
            :loading="testingSenderId === sender.id"
            @click="testSender(sender)"
          />
          <Button
            text
            size="small"
            severity="danger"
            icon="pi pi-trash"
            :label="t('delete')"
            @click="confirmDelete(sender)"
          />
          <Tag
            :value="sender.active ? t('active') : t('inactive')"
            :severity="sender.active ? 'success' : 'secondary'"
          />
        </div>
      </div>
    </div>

    <AddEmailSenderDialog
      v-model:visible="showAddDialog"
      :editing-sender="editingSender"
      @sender-saved="$store.fetchSenders()"
    />

    <ConfirmDialog />
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "add_email_sender": "Add Email Sender",
    "no_senders_configured": "No email senders configured",
    "active": "Active",
    "inactive": "Inactive",
    "edit": "Edit",
    "test": "Test",
    "delete": "Delete",
    "linked_to_source": "Linked to source",
    "test_successful": "Test email sent successfully",
    "test_failed": "Test email failed",
    "sender_deleted": "Email sender deleted",
    "delete_failed": "Failed to delete sender",
    "delete_confirm_message": "Are you sure you want to delete the sender \"{name}\"?",
    "delete_confirm_header": "Confirm Deletion"
  },
  "fr": {
    "add_email_sender": "Ajouter un expéditeur email",
    "no_senders_configured": "Aucun expéditeur email configuré",
    "active": "Actif",
    "inactive": "Inactif",
    "edit": "Modifier",
    "test": "Tester",
    "delete": "Supprimer",
    "linked_to_source": "Lié à une source",
    "test_successful": "Email de test envoyé avec succès",
    "test_failed": "Échec de l'envoi de l'email de test",
    "sender_deleted": "Expéditeur email supprimé",
    "delete_failed": "Échec de la suppression",
    "delete_confirm_message": "Êtes-vous sûr de vouloir supprimer l'expéditeur \"{name}\" ?",
    "delete_confirm_header": "Confirmer la suppression"
  }
}
</i18n>
