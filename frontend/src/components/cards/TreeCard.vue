<template>
  <Tree
    v-model:value="leadminerStore.boxes"
    v-model:selection-keys="leadminerStore.selectedBoxes"
    v-model:expanded-keys="expandedKeys"
    selection-mode="checkbox"
  >
    <template #default="{ node }">
      {{ node.label }}
      <Badge>
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
