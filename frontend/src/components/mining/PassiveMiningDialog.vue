<template>
  <Dialog
    v-model:visible="$leadminerStore.passiveMiningDialog"
    modal
    :header="t('header')"
    class="w-full sm:w-[35rem]"
  >
    <div class="flex flex-col gap-4">
      <p>
        {{ t('paragraph_1') }} <br />
        {{ t('paragraph_2') }}
      </p>

      <div class="flex flex-col gap-2 pt-2 border-t border-surface-200">
        <div class="font-medium">{{ t('folders_title') }}</div>
        <div class="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
          <div
            v-for="row in folderRows"
            :key="row.key"
            class="flex items-center gap-2"
          >
            <Checkbox
              v-model="folderSelection"
              :input-id="`passive-folder-${row.key}`"
              :value="row.key"
            />
            <label
              :for="`passive-folder-${row.key}`"
              class="cursor-pointer flex-1"
              >{{ row.label }}</label
            >
            <Badge v-if="row.isNew" severity="info">{{
              t('folders_new')
            }}</Badge>
            <Badge v-if="row.unavailable" severity="secondary">{{
              t('folders_unavailable')
            }}</Badge>
          </div>
        </div>
        <small v-if="folderSelection.length === 0" class="text-red-500">{{
          t('folders_required')
        }}</small>
      </div>

      <div class="flex flex-col gap-3 pt-2 border-t border-surface-200">
        <div v-if="isGoogleSource" class="flex items-center gap-2">
          <ToggleSwitch
            v-model="draftConfig.google_contacts_sync"
            input-id="googleContactsSync"
          />
          <label for="googleContactsSync" class="cursor-pointer">
            {{ t('sync_google_contacts') }}
          </label>
        </div>

        <div class="flex items-center gap-2">
          <ToggleSwitch
            v-model="draftConfig.cleaning_enabled"
            input-id="cleaningEnabled"
          />
          <label for="cleaningEnabled" class="cursor-pointer">
            {{ t('clean_contacts') }}
          </label>
        </div>

        <div class="flex items-center gap-2">
          <ToggleSwitch
            v-model="draftConfig.extract_signatures"
            input-id="extractSignatures"
          />
          <label for="extractSignatures" class="cursor-pointer">
            {{ t('extract_signatures') }}
          </label>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex flex-col sm:flex-row justify-between w-full gap-2">
        <Button
          :label="$t('common.cancel')"
          class="w-full sm:w-auto"
          severity="secondary"
          @click="closePassiveMiningDialog()"
        />
        <Button
          :label="
            dialogMode === 'update' ? t('update_folders') : t('yes_enable')
          "
          class="w-full sm:w-auto"
          :loading="isSaving"
          :disabled="isSaving || folderSelection.length === 0"
          @click="enablePassiveMining()"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast';
import type { MiningSource } from '~/types/mining';
import type { BoxNode } from '~/utils/boxes';
import { deriveSourceConfig } from '~/utils/miningSourceConfig';
import { buildPassiveFolderList } from '~/utils/passive-mining-folders';
import { updatePassiveMining } from '~/utils/sources';

const $leadminerStore = useLeadminerStore();

const miningSource = ref<MiningSource>();
const draftConfig = ref<Record<string, boolean>>({
  google_contacts_sync: false,
  cleaning_enabled: true,
  extract_signatures: false,
});
const $toast = useToast();

const { t } = useI18n({
  useScope: 'local',
});

const isGoogleSource = computed(() => miningSource.value?.type === 'google');

const folderSelection = ref<string[]>([]);
const isSaving = ref(false);
const dialogMode = computed(() => $leadminerStore.passiveMiningDialogMode);
const folderRows = computed(() => {
  const registered = Array.isArray(miningSource.value?.config?.folders)
    ? miningSource.value.config.folders.filter(
        (f): f is string => typeof f === 'string',
      )
    : [];
  const mined = $leadminerStore.selectedBoxes
    ? Object.keys($leadminerStore.selectedBoxes).filter(
        (key) =>
          key !== '' &&
          $leadminerStore.selectedBoxes[key]?.checked &&
          !$leadminerStore.excludedBoxes?.has(key),
      )
    : [];
  const flat = (nodes: BoxNode[]): string[] =>
    nodes.flatMap((n) => [n.key, ...flat(n.children ?? [])]);
  const available = $leadminerStore.boxes?.length
    ? flat($leadminerStore.boxes)
    : [...new Set([...mined, ...registered])];
  return buildPassiveFolderList({
    mined,
    registered,
    available,
    labelFor: (key: string) =>
      key.toUpperCase() === 'INBOX'
        ? t('folder_inbox')
        : (key.split('/').pop() ?? key),
  });
});

watch(
  () => $leadminerStore.passiveMiningDialog,
  (newVal, oldVal) => {
    if (newVal && !oldVal) {
      miningSource.value = $leadminerStore.activeMiningSource;
      const flags = deriveSourceConfig(
        $leadminerStore.activeMiningSource?.config,
      );
      draftConfig.value = { ...flags };
      folderSelection.value = folderRows.value
        .filter((row) => row.checked)
        .map((row) => row.key);
    }
  },
);

function closePassiveMiningDialog() {
  $leadminerStore.passiveMiningDialog = false;
}

async function enablePassiveMining() {
  if (!miningSource.value || folderSelection.value.length === 0) return;
  isSaving.value = true;
  try {
    const mergedConfig = await updatePassiveMining(
      miningSource.value.email,
      miningSource.value.type,
      true,
      {
        flags: { ...draftConfig.value },
        folders: [...folderSelection.value],
      },
    );
    $leadminerStore.sourceConfig = deriveSourceConfig({
      ...($leadminerStore.activeMiningSource?.config ?? {}),
      flags: { ...(draftConfig.value as Record<string, boolean>) },
    });
    // /sources binds its switch to the miningSources list, which would still
    // show passive_mining off: sync the entry from the merged response.
    const listEntry = $leadminerStore.miningSources.find(
      (source) =>
        source.email === miningSource.value?.email &&
        source.type === miningSource.value?.type,
    );
    if (listEntry) {
      listEntry.passive_mining = true;
      listEntry.config = mergedConfig;
    } else {
      await $leadminerStore.fetchMiningSources();
    }
    closePassiveMiningDialog();
  } catch (error) {
    const message =
      (error as { message?: string }).message ||
      'Failed to enable continuous mining';
    $toast.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000,
    });
  } finally {
    isSaving.value = false;
  }
}
</script>

<i18n lang="json">
{
  "en": {
    "header": "Continuous Contact Extraction",
    "paragraph_1": "New contacts found in incoming emails will be automatically saved.",
    "paragraph_2": "Enable continuous contact extraction from future emails?",
    "sync_google_contacts": "Sync Google Contacts",
    "clean_contacts": "Clean contacts (email verification)",
    "extract_signatures": "Extract signatures",
    "yes_enable": "Yes, enable",
    "update_folders": "Update folders",
    "folders_title": "Folders for continuous extraction",
    "folders_new": "New",
    "folders_unavailable": "Unavailable",
    "folders_required": "Select at least one folder",
    "folder_inbox": "Inbox"
  },
  "fr": {
    "header": "Extraction continue des contacts",
    "paragraph_1": "Les nouveaux contacts trouvés dans les e-mails entrants seront automatiquement enregistrés.",
    "paragraph_2": "Activer l'extraction continue des contacts à partir des futurs e-mails ?",
    "sync_google_contacts": "Synchroniser les contacts Google",
    "clean_contacts": "Nettoyer les contacts (vérification e-mail)",
    "extract_signatures": "Extraire les signatures",
    "yes_enable": "Oui, activer",
    "update_folders": "Mettre à jour les dossiers",
    "folders_title": "Dossiers pour l'extraction continue",
    "folders_new": "Nouveau",
    "folders_unavailable": "Indisponible",
    "folders_required": "Sélectionnez au moins un dossier",
    "folder_inbox": "Boîte de réception"
  }
}
</i18n>
