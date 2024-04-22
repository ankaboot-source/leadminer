<template>
  <Tree
    v-model:value="leadminerStore.boxes"
    v-model:selection-keys="leadminerStore.selectedBoxes"
    v-model:expanded-keys="expandedKeys"
    selection-mode="checkbox"
  >
    <template #default="{ node }">
      {{ node.label }}
      <Badge
        v-if="node.key! in expandedKeys"
        v-tooltip="'Total emails in this folder'"
        severity="secondary"
      >
        {{ node.total ? node.total : node.cumulativeTotal }}
      </Badge>
      <Badge v-else>
        {{ node.total ? node.total : node.cumulativeTotal }}
      </Badge>
    </template>
  </Tree>
</template>

<script setup lang="ts">
import { useLeadminerStore } from '@/stores/leadminer';

const leadminerStore = useLeadminerStore();
const expandedKeys = ref({});
</script>
