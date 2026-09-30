<template>
  <Dialog
    :visible="visible"
    modal
    :header="t('header')"
    class="w-full sm:w-[35rem]"
    @update:visible="(value: boolean) => emit('update:visible', value)"
  >
    <div class="flex flex-col gap-4">
      <p>
        {{ t('paragraph_1') }} <br />
        {{ t('paragraph_2') }}
      </p>

      <div v-if="loading" class="flex justify-center py-6">
        <ProgressSpinner class="size-10" stroke-width="4" />
      </div>

      <template v-else>
        <div class="flex flex-col gap-2 pt-2 border-t border-surface-200">
          <div class="font-medium">{{ t('folders_title') }}</div>
          <div class="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            <div
              v-for="row in rows"
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
      </template>
    </div>

    <template #footer>
      <div class="flex flex-col sm:flex-row justify-between w-full gap-2">
        <Button
          :label="$t('common.cancel')"
          class="w-full sm:w-auto"
          severity="secondary"
          :disabled="saving"
          @click="emit('update:visible', false)"
        />
        <Button
          :label="mode === 'update' ? t('update_folders') : t('yes_enable')"
          class="w-full sm:w-auto"
          :loading="saving"
          :disabled="saving || loading || folderSelection.length === 0"
          @click="confirm"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import type { MiningSource } from '~/types/mining';
import type { PassiveFolderRow } from '~/utils/passive-mining-folders';
import type { MiningSourceConfigFlags } from '~/utils/miningSourceConfig';
import { deriveSourceConfig } from '~/utils/miningSourceConfig';

const props = withDefaults(
  defineProps<{
    visible: boolean;
    source?: MiningSource;
    mode?: 'first-time' | 'update';
    rows?: PassiveFolderRow[];
    saving?: boolean;
    loading?: boolean;
  }>(),
  {
    mode: 'first-time',
    rows: () => [],
    saving: false,
    loading: false,
    source: undefined,
  },
);

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (
    e: 'confirm',
    payload: { folders: string[]; flags: MiningSourceConfigFlags },
  ): void;
}>();

const { t } = useI18n({ useScope: 'local' });

const isGoogleSource = computed(() => props.source?.type === 'google');
const folderSelection = ref<string[]>([]);
const draftConfig = ref<MiningSourceConfigFlags>(deriveSourceConfig());
// True while the dialog is open but its rows have not arrived yet (IMAP fetch
// for a never-mined source). Guards against clobbering user edits later.
const awaitingRows = ref(false);

function syncSelection() {
  folderSelection.value = props.rows
    .filter((row) => row.checked)
    .map((row) => row.key);
}

// Discards any local edits (switches + folder selection) so a cancelled or
// closed dialog reopens from the persisted source configuration.
function resetDraft() {
  draftConfig.value = deriveSourceConfig(props.source?.config);
  folderSelection.value = [];
  awaitingRows.value = false;
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      resetDraft();
      return;
    }
    draftConfig.value = deriveSourceConfig(props.source?.config);
    syncSelection();
    awaitingRows.value = props.loading || props.rows.length === 0;
  },
  { immediate: true },
);

watch(
  () => props.rows,
  () => {
    if (!props.visible || !awaitingRows.value || props.rows.length === 0) {
      return;
    }
    syncSelection();
    awaitingRows.value = false;
  },
);

function confirm() {
  if (folderSelection.value.length === 0) return;
  emit('confirm', {
    folders: [...folderSelection.value],
    flags: { ...draftConfig.value },
  });
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
    "folders_required": "Select at least one folder"
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
    "folders_required": "Sélectionnez au moins un dossier"
  }
}
</i18n>
