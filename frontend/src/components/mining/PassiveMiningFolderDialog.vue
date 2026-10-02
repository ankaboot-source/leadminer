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
          <div class="max-h-64 overflow-y-auto pr-1">
            <EmailFoldersTree
              v-model:selection-keys="selectionKeys"
              :boxes="boxes"
            />
          </div>
          <small v-if="selectedFolders.length === 0" class="text-red-500">{{
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
          :label="t('enable')"
          class="w-full sm:w-auto"
          :loading="saving"
          :disabled="saving || loading || selectedFolders.length === 0"
          @click="confirm"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import type { TreeSelectionKeys } from 'primevue/tree';
import type { MiningSource } from '~/types/mining';
import { getDefaultAndExcludedFolders, type BoxNode } from '~/utils/boxes';
import type { MiningSourceConfigFlags } from '~/utils/miningSourceConfig';
import { deriveSourceConfig } from '~/utils/miningSourceConfig';
import { buildTreeSelectionKeys } from '~/utils/box-tree';
import { getSelectedFolderKeys } from '~/utils/selected-folders';
// skipcq: JS-W1028 - Nuxt SFCs are default imports; DeepSource cannot detect script-setup default exports
import EmailFoldersTree from './stepper-panels/mine/EmailFoldersTree.vue';

const props = withDefaults(
  defineProps<{
    visible: boolean;
    source?: MiningSource;
    boxes?: BoxNode[];
    checked?: string[];
    saving?: boolean;
    loading?: boolean;
  }>(),
  {
    boxes: () => [],
    checked: () => [],
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
const selectionKeys = ref<TreeSelectionKeys>({});
const draftConfig = ref<MiningSourceConfigFlags>(deriveSourceConfig());
// True while the dialog is open but its tree has not arrived yet (IMAP fetch
// for a never-mined source). Guards against clobbering user edits later.
const awaitingBoxes = ref(false);

// `\Noselect` folders are returned by the tree but must never be submitted.
// Reuse the same exclusion set every other "selected folders" read uses.
const excludedKeys = computed(
  () => getDefaultAndExcludedFolders(props.boxes).excludedKeys,
);

const selectedFolders = computed(() =>
  getSelectedFolderKeys(selectionKeys.value, excludedKeys.value),
);

function seedSelection() {
  selectionKeys.value = buildTreeSelectionKeys(props.boxes, props.checked);
}

// Discards any local edits (switches + folder selection) so a cancelled or
// closed dialog reopens from the persisted source configuration.
function resetDraft() {
  draftConfig.value = deriveSourceConfig(props.source?.config);
  selectionKeys.value = {};
  awaitingBoxes.value = false;
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      resetDraft();
      return;
    }
    draftConfig.value = deriveSourceConfig(props.source?.config);
    seedSelection();
    awaitingBoxes.value = props.loading || props.boxes.length === 0;
  },
  { immediate: true },
);

watch(
  () => props.boxes,
  () => {
    if (!props.visible || !awaitingBoxes.value || props.boxes.length === 0) {
      return;
    }
    seedSelection();
    awaitingBoxes.value = false;
  },
);

function confirm() {
  if (selectedFolders.value.length === 0) return;
  emit('confirm', {
    folders: [...selectedFolders.value],
    flags: { ...draftConfig.value },
  });
}
</script>

<i18n lang="json">
{
  "en": {
    "header": "Passive mining",
    "paragraph_1": "New contacts found in incoming emails will be automatically saved.",
    "paragraph_2": "Enable passive mining for future incoming emails?",
    "sync_google_contacts": "Sync Google Contacts",
    "clean_contacts": "Clean contacts (email verification)",
    "extract_signatures": "Extract signatures",
    "enable": "Enable passive mining",
    "folders_title": "Select folders to mine",
    "folders_required": "Select at least one folder"
  },
  "fr": {
    "header": "Extraction passive",
    "paragraph_1": "Les nouveaux contacts trouvés dans les e-mails entrants seront automatiquement enregistrés.",
    "paragraph_2": "Activer l'extraction passive pour les futurs e-mails entrants ?",
    "sync_google_contacts": "Synchroniser les contacts Google",
    "clean_contacts": "Nettoyer les contacts (vérification e-mail)",
    "extract_signatures": "Extraire les signatures",
    "enable": "Activer l'extraction passive",
    "folders_title": "Sélectionnez les dossiers à extraire",
    "folders_required": "Sélectionnez au moins un dossier"
  }
}
</i18n>
