<template>
  <PassiveMiningFolderDialog
    :visible="$leadminerStore.passiveMiningDialog"
    :source="$leadminerStore.activeMiningSource"
    :boxes="boxes"
    :checked="checkedFolders"
    :saving="isSaving"
    @update:visible="
      (value: boolean) => ($leadminerStore.passiveMiningDialog = value)
    "
    @confirm="onConfirm"
  />
</template>

<script setup lang="ts">
import {
  folderDisplayName,
  getSelectedFolderKeys,
} from '~/utils/selected-folders';
import { getDefaultAndExcludedFolders, type BoxNode } from '~/utils/boxes';
import type { MiningSourceConfigFlags } from '~/utils/miningSourceConfig';
// skipcq: JS-W1028 - Nuxt SFCs are default imports; DeepSource cannot detect script-setup default exports
import PassiveMiningFolderDialog from './PassiveMiningFolderDialog.vue';

const $leadminerStore = useLeadminerStore();
const { t: $t } = useI18n({ useScope: 'global' });
const { isSaving, enablePassiveMining } = useEnablePassiveMining();

const seedKeys = computed(() => {
  const configFolders = $leadminerStore.activeMiningSource?.config?.folders;
  const registered = Array.isArray(configFolders)
    ? configFolders.filter(
        (folder): folder is string =>
          typeof folder === 'string' && folder !== '',
      )
    : [];
  const mined = getSelectedFolderKeys(
    $leadminerStore.selectedBoxes,
    $leadminerStore.excludedBoxes,
  );
  const union = [...registered];
  for (const key of mined) {
    if (!union.includes(key)) union.push(key);
  }
  return union;
});

// Prefer the live store tree; fall back to flat nodes for the known keys so the
// post-run prompt stays usable when the tree was never loaded into the store.
const boxes = computed<BoxNode[]>(() => {
  if ($leadminerStore.boxes.length > 0) return $leadminerStore.boxes;
  return seedKeys.value.map((key) => ({
    key,
    label: folderDisplayName(key, $t('sources.folder_inbox')),
    total: 0,
  }));
});

const checkedFolders = computed(() => {
  if (seedKeys.value.length > 0) return seedKeys.value;
  const { defaultFolders, excludedKeys } = getDefaultAndExcludedFolders(
    $leadminerStore.boxes,
  );
  return getSelectedFolderKeys(defaultFolders, excludedKeys);
});

async function onConfirm(payload: {
  folders: string[];
  flags: MiningSourceConfigFlags;
}) {
  const source = $leadminerStore.activeMiningSource;
  if (!source) return;
  const enabled = await enablePassiveMining(
    source,
    payload.folders,
    payload.flags,
  );
  if (enabled) $leadminerStore.passiveMiningDialog = false;
}
</script>
