<template>
  <PassiveMiningFolderDialog
    :visible="$leadminerStore.passiveMiningDialog"
    :source="$leadminerStore.activeMiningSource"
    :boxes="boxes"
    :checked="runFolders"
    :new-folders="newFolders"
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
import type { BoxNode } from '~/utils/boxes';
import type { MiningSourceConfigFlags } from '~/utils/miningSourceConfig';
// skipcq: JS-W1028 - Nuxt SFCs are default imports; DeepSource cannot detect script-setup default exports
import PassiveMiningFolderDialog from './PassiveMiningFolderDialog.vue';

const $leadminerStore = useLeadminerStore();
const { t: $t } = useI18n({ useScope: 'global' });
const { isSaving, enablePassiveMining } = useEnablePassiveMining();

/**
 * Folders the just-finished run mined. Mirrors the resolution used by
 * `maybeOpenPassiveMiningDialog`, so the prompt always offers exactly the
 * folders that triggered it.
 */
const runFolders = computed(() => {
  const lastRun = $leadminerStore.lastRunEmailFolders;
  if (lastRun && lastRun.length > 0) return lastRun;
  return getSelectedFolderKeys(
    $leadminerStore.selectedBoxes,
    $leadminerStore.excludedBoxes,
  );
});

// A flat list, never the mailbox tree: after a run the user only has to confirm
// the folders they just mined, not re-pick them out of the whole account.
const boxes = computed<BoxNode[]>(() =>
  runFolders.value.map((key) => ({
    key,
    label: folderDisplayName(key, $t('sources.folder_inbox')),
    total: 0,
  })),
);

// Folders in this run that passive mining does not watch yet.
const newFolders = computed(() => {
  const configFolders = $leadminerStore.activeMiningSource?.config?.folders;
  const registered = new Set(
    Array.isArray(configFolders)
      ? configFolders.filter(
          (folder): folder is string =>
            typeof folder === 'string' && folder !== '',
        )
      : [],
  );
  return runFolders.value.filter((key) => !registered.has(key));
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
