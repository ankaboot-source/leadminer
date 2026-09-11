<template>
  <Tree
    v-model:value="leadminerStore.boxes"
    v-model:selection-keys="leadminerStore.selectedBoxes"
    v-model:expanded-keys="expandedKeys"
    selection-mode="checkbox"
    class="px-0"
  >
    <template #default="{ node }">
      <span
        v-if="folderStatus(node).state === 'new_messages'"
        class="inline-block size-2 rounded-full bg-amber-500 mr-2"
        :title="t('new_messages_available')"
        :aria-label="t('new_messages_available')"
      />
      <span
        v-else-if="folderStatus(node).state === 'uidvalidity_changed'"
        class="inline-block size-2 rounded-full bg-red-500 mr-2"
        :title="t('mailbox_identity_changed')"
        :aria-label="t('mailbox_identity_changed')"
      />
      {{ node.label }}
      <Badge>
        {{ (node.total ? node.total : node.cumulativeTotal).toLocaleString() }}
      </Badge>
    </template>
  </Tree>
</template>

<script setup lang="ts">
import { useLeadminerStore } from '@/stores/leadminer';
import { resolveMiningFolderState } from '@/utils/miningFolderState';
import type { ImapFolderCursor } from '@/utils/boxes';

const { t } = useI18n({ useScope: 'local' });
const leadminerStore = useLeadminerStore();
const expandedKeys = ref({ '': true });

function folderStatus(node: unknown) {
  const folder = node as { key?: string; cursor?: ImapFolderCursor };
  if (!folder.key) {
    return resolveMiningFolderState(undefined);
  }
  const watermark =
    leadminerStore.activeMiningSource?.config?.mining?.last?.folders?.[
      folder.key
    ];
  return resolveMiningFolderState(folder.cursor, watermark);
}
</script>

<i18n lang="json">
{
  "en": {
    "new_messages_available": "Previously mined — new messages available",
    "mailbox_identity_changed": "Mailbox identity changed — a full scan is required"
  },
  "fr": {
    "new_messages_available": "Dossier déjà traité — nouveaux messages disponibles",
    "mailbox_identity_changed": "L'identité de la boîte a changé — une analyse complète est nécessaire"
  }
}
</i18n>
