<template>
  <div
    class="flex flex-col grow border border-surface-200 rounded-md p-4 gap-4"
  >
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">{{ t('sources') }}</h1>
    </div>

    <DataView
      :value="$leadminer.miningSources"
      data-key="email"
      :paginator="true"
      :rows="10"
    >
      <template #empty>
        <div class="text-center py-8 text-surface-500">
          {{ t('no_sources') }}
        </div>
      </template>
      <template #list="slotProps">
        <div class="grid gap-3">
          <div
            v-for="source in slotProps.items"
            :key="source.email"
            class="border border-surface-200 rounded-md p-4"
          >
            <div class="flex items-center justify-between gap-2">
              <div>
                <div class="font-medium">{{ source.email }}</div>
                <div class="text-sm text-surface-500 flex items-center gap-2">
                  <i
                    :class="getIcon(source.type)"
                    class="text-secondary text-sm"
                  ></i>
                  <span>{{ source.type }}</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <Button
                  v-if="isActiveMiningSource(source)"
                  size="small"
                  outlined
                  severity="warning"
                  icon="pi pi-stop"
                  :label="t('stop_extraction')"
                  :loading="isStoppingMining"
                  @click="confirmStopMining"
                />
                <Button
                  size="small"
                  outlined
                  severity="danger"
                  icon="pi pi-trash"
                  :label="t('delete_source')"
                  :loading="
                    isDeleting && deletingSource?.email === source.email
                  "
                  @click="openDeleteDialog(source)"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-sm">
              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500">{{ t('email') }}</div>
                <div class="font-medium truncate">{{ source.email }}</div>
              </div>

              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500">{{ t('type') }}</div>
                <div class="flex items-center gap-2 font-medium">
                  <i :class="getIcon(source.type)" class="text-secondary"></i>
                  <span>{{ source.type }}</span>
                </div>
              </div>

              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500">{{ t('passive_mining') }}</div>
                <div class="flex items-center gap-2">
                  <span
                    v-if="source.passive_mining"
                    class="relative flex h-3 w-3"
                  >
                    <span
                      class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"
                    ></span>
                    <span
                      class="relative inline-flex h-3 w-3 rounded-full bg-green-500"
                    ></span>
                  </span>
                  <span
                    v-else
                    class="inline-flex h-3 w-3 rounded-full bg-gray-500"
                  ></span>
                  <span>{{
                    source.passive_mining ? t('enabled') : t('disabled')
                  }}</span>
                </div>
              </div>

              <div class="p-2 rounded bg-surface-50">
                <div class="text-surface-500">{{ t('credentials') }}</div>
                <div class="flex items-center gap-2">
                  <Tag
                    :value="
                      source.isValid ? t('valid') : t('expired_credentials')
                    "
                    :severity="source.isValid ? 'success' : 'warn'"
                  />
                </div>
              </div>
            </div>

            <div
              v-if="isActiveMiningSource(source)"
              class="mt-4 p-3 rounded bg-surface-50 border border-primary/20"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="relative flex h-3 w-3">
                    <span
                      class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"
                    ></span>
                    <span
                      class="relative inline-flex h-3 w-3 rounded-full bg-primary"
                    ></span>
                  </span>
                  <span class="font-medium text-primary">{{
                    t('mining_in_progress')
                  }}</span>
                </div>
                <div class="text-sm text-surface-600">
                  {{ t('emails_scanned') }}: {{ $leadminer.scannedEmails }} |
                  {{ t('emails_extracted') }}:
                  {{ $leadminer.extractedEmails }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </DataView>

    <Dialog
      v-model:visible="deleteDialogVisible"
      modal
      :header="t('delete_source')"
      :style="{ width: '28rem', maxWidth: '95vw' }"
    >
      <div class="text-sm text-surface-700">
        {{ t('delete_source_confirm') }}
      </div>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <Button outlined :label="t('cancel')" @click="closeDeleteDialog" />
          <Button
            severity="danger"
            :label="t('delete_source')"
            :loading="isDeleting"
            @click="confirmDelete"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import type { MiningSource } from '~/types/mining';

const $leadminer = useLeadminerStore();
const { t } = useI18n({
  useScope: 'local',
});
const { $saasEdgeFunctions } = useNuxtApp();
const $toast = useToast();

const deleteDialogVisible = ref(false);
const deletingSource = ref<MiningSource | null>(null);
const isDeleting = ref(false);
const isStoppingMining = ref(false);

function isActiveMiningSource(source: MiningSource): boolean {
  return (
    Boolean($leadminer.activeMiningSource?.email === source.email &&
    $leadminer.miningTask)
  );
}

function getIcon(type: string) {
  switch (type) {
    case 'google':
      return 'pi pi-google';
    case 'azure':
      return 'pi pi-microsoft';
    default:
      return 'pi pi-inbox';
  }
}

function openDeleteDialog(source: MiningSource) {
  deletingSource.value = source;
  deleteDialogVisible.value = true;
}

function closeDeleteDialog() {
  deleteDialogVisible.value = false;
  deletingSource.value = null;
}

async function confirmDelete() {
  if (!deletingSource.value) return;

  isDeleting.value = true;

  try {
    await $saasEdgeFunctions('delete-mining-source', {
      method: 'DELETE',
      body: { email: deletingSource.value.email },
    });

    $toast.add({
      severity: 'success',
      summary: t('source_deleted'),
      detail: t('source_deleted_detail'),
      life: 3500,
    });

    closeDeleteDialog();
    await $leadminer.fetchMiningSources();
  } catch (error) {
    $toast.add({
      severity: 'error',
      summary: t('delete_source_failed'),
      detail: (error as Error).message,
      life: 4500,
    });
  } finally {
    isDeleting.value = false;
  }
}

async function confirmStopMining() {
  isStoppingMining.value = true;
  try {
    await $leadminer.stopMining(true, null);
    $toast.add({
      severity: 'success',
      summary: t('mining_stopped'),
      detail: t('mining_stopped_detail'),
      life: 3500,
    });
  } catch (error) {
    $toast.add({
      severity: 'error',
      summary: t('stop_mining_failed'),
      detail: (error as Error).message,
      life: 4500,
    });
  } finally {
    isStoppingMining.value = false;
  }
}

onMounted(async () => {
  await $leadminer.fetchMiningSources();
  await $leadminer.getCurrentRunningMining();
});
</script>

<i18n lang="json">
{
  "en": {
    "sources": "Sources",
    "no_sources": "No sources yet",
    "email": "Email",
    "type": "Type",
    "passive_mining": "Passive mining",
    "credentials": "Credentials",
    "status": "Status",
    "valid": "Valid",
    "expired_credentials": "Expired credentials",
    "enabled": "Enabled",
    "disabled": "Disabled",
    "delete_source": "Delete",
    "delete_source_confirm": "Delete this mining source permanently? This action cannot be undone.",
    "cancel": "Cancel",
    "source_deleted": "Source deleted",
    "source_deleted_detail": "The mining source has been permanently deleted.",
    "delete_source_failed": "Unable to delete source",
    "stop_extraction": "Stop extraction",
    "mining_in_progress": "Mining in progress",
    "emails_scanned": "Scanned",
    "emails_extracted": "Extracted",
    "mining_stopped": "Mining stopped",
    "mining_stopped_detail": "The mining process has been stopped.",
    "stop_mining_failed": "Unable to stop mining"
  },
  "fr": {
    "sources": "Sources",
    "no_sources": "Aucune source",
    "email": "Email",
    "type": "Type",
    "passive_mining": "Extraction passive",
    "credentials": "Identifiants",
    "status": "Statut",
    "valid": "Valide",
    "expired_credentials": "Identifiants expirés",
    "enabled": "Activé",
    "disabled": "Désactivé",
    "delete_source": "Supprimer",
    "delete_source_confirm": "Supprimer définitivement cette source de minage ? Cette action est irréversible.",
    "cancel": "Annuler",
    "source_deleted": "Source supprimée",
    "source_deleted_detail": "La source de minage a été supprimée définitivement.",
    "delete_source_failed": "Impossible de supprimer la source",
    "stop_extraction": "Arrêter l'extraction",
    "mining_in_progress": "Extraction en cours",
    "emails_scanned": "Scannés",
    "emails_extracted": "Extracts",
    "mining_stopped": "Extraction stoppée",
    "mining_stopped_detail": "Le processus d'extraction a été stoppé.",
    "stop_mining_failed": "Impossible de stopper l'extraction"
  }
}
</i18n>
