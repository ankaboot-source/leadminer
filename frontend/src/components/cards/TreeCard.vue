<template>
  <Tree
    v-model:value="leadminerStore.boxes"
    v-model:expanded-keys="expandedKeys"
    class="px-0"
  >
    <template #default="{ node }">
      <Checkbox
        v-model="leadminerStore.selectedBoxes"
        class="align-middle mr-2"
        :value="node.key"
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

const leadminerStore = useLeadminerStore();
const expandedKeys = ref({ '': true });
</script>
