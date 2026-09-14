<template>
  <div>
    <div
      v-if="hasMinedFolders"
      class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-surface-500 mt-2 mb-1"
    >
      <span class="flex items-center gap-1.5">
        <span class="inline-block size-2 shrink-0 rounded-full bg-amber-500" />
        {{ t('legend_new') }}
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block size-2 shrink-0 rounded-full bg-red-500" />
        {{ t('legend_rescan') }}
      </span>
      <span class="flex items-center gap-1.5">
        <i class="pi pi-check-circle text-slate-400 text-xs" />
        {{ t('legend_up_to_date') }}
      </span>
    </div>
    <Tree
      v-model:value="leadminerStore.boxes"
      v-model:selection-keys="leadminerStore.selectedBoxes"
      v-model:expanded-keys="expandedKeys"
      selection-mode="checkbox"
      class="px-0"
    >
      <template #default="{ node }">
        <span
          v-if="node.status === FolderStatus.NewMessages"
          class="inline-block size-2 shrink-0 rounded-full bg-amber-500 mr-2"
          :title="t('tooltip_new')"
          :aria-label="t('tooltip_new')"
        />
        <span
          v-else-if="node.status === FolderStatus.UidvalidityChanged"
          class="inline-block size-2 shrink-0 rounded-full bg-red-500 mr-2"
          :title="t('tooltip_rescan')"
          :aria-label="t('tooltip_rescan')"
        />
        <i
          v-else-if="node.status === FolderStatus.UpToDate"
          class="pi pi-check-circle text-slate-400 text-xs mr-2"
          :title="t('tooltip_up_to_date')"
          :aria-label="t('tooltip_up_to_date')"
        />
        {{ node.label }}
        <Badge>
          {{
            (node.total ? node.total : node.cumulativeTotal).toLocaleString()
          }}
        </Badge>
      </template>
    </Tree>
  </div>
</template>

<script setup lang="ts">
import { useLeadminerStore } from '@/stores/leadminer';
import { FolderStatus } from '~/types/enums';
import type { BoxNode } from '~/utils/boxes';

const { t } = useI18n({ useScope: 'local' });
const leadminerStore = useLeadminerStore();
const expandedKeys = ref({ '': true });

/**
 * The legend only makes sense once at least one folder carries a sync status
 * from a previous mine; for a first-time tree it would be unexplainable noise.
 */
const hasMinedFolders = computed(() => {
  const hasStatus = (nodes: BoxNode[]): boolean =>
    nodes.some(
      (node) =>
        (node.status && node.status !== FolderStatus.Unmined) ||
        hasStatus(node.children ?? []),
    );
  return hasStatus(leadminerStore.boxes as BoxNode[]);
});
</script>

<i18n lang="json">
{
  "en": {
    "legend_new": "New messages",
    "legend_rescan": "Full re-scan needed",
    "legend_up_to_date": "Already mined",
    "tooltip_new": "New messages arrived since the last mine",
    "tooltip_rescan": "This folder was re-created server-side; it will be fully re-scanned",
    "tooltip_up_to_date": "Mined and nothing new since"
  },
  "fr": {
    "legend_new": "Nouveaux messages",
    "legend_rescan": "Re-scan complet requis",
    "legend_up_to_date": "Déjà extrait",
    "tooltip_new": "Nouveaux messages depuis la dernière extraction",
    "tooltip_rescan": "Ce dossier a été recréé côté serveur ; il sera entièrement re-scanné",
    "tooltip_up_to_date": "Déjà extrait, rien de nouveau depuis"
  }
}
</i18n>
