<template>
  <PassiveMiningFolderDialog
    :visible="$leadminerStore.passiveMiningDialog"
    :source="$leadminerStore.activeMiningSource"
    :mode="$leadminerStore.passiveMiningDialogMode"
    :rows="folderRows"
    :saving="isSaving"
    @update:visible="
      (value: boolean) => ($leadminerStore.passiveMiningDialog = value)
    "
    @confirm="onConfirm"
  />
</template>

<script setup lang="ts">
import { flattenBoxNodes } from '~/utils/box-tree';
import { buildPassiveFolderList } from '~/utils/passive-mining-folders';
import {
  folderDisplayName,
  getSelectedFolderKeys,
} from '~/utils/selected-folders';
import type { MiningSourceConfigFlags } from '~/utils/miningSourceConfig';
import PassiveMiningFolderDialog from './PassiveMiningFolderDialog.vue';

const $leadminerStore = useLeadminerStore();
const { t } = useI18n({ useScope: 'global' });
const { isSaving, enablePassiveMining } = useEnablePassiveMining();

const folderRows = computed(() => {
  const registered = Array.isArray(
    $leadminerStore.activeMiningSource?.config?.folders,
  )
    ? ($leadminerStore.activeMiningSource?.config?.folders as string[]).filter(
        (folder): folder is string => typeof folder === 'string',
      )
    : [];
  const mined = getSelectedFolderKeys(
    $leadminerStore.selectedBoxes,
    $leadminerStore.excludedBoxes,
  );
  const available = $leadminerStore.boxes?.length
    ? flattenBoxNodes($leadminerStore.boxes).map((node) => node.key)
    : [...new Set([...mined, ...registered])];
  return buildPassiveFolderList({
    mined,
    registered,
    available,
    labelFor: (key: string) =>
      folderDisplayName(key, t('sources.folder_inbox')),
  });
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
