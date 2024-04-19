<<<<<<< HEAD
<template>
  <q-tree
    ref="tree"
    v-model:ticked="leadminerStore.selectedBoxes"
    class="col-10 col-sm-6 q-ma-sm"
    icon="arrow_forward_ios"
    :nodes="leadminerStore.boxes"
    node-key="path"
    color="primary"
    control-color="primary"
    tick-strategy="leaf"
  >
    <template #default-header="prop">
      <div
        class="full-width row inline no-wrap justify-between items-end content-center borderForBoxes"
      >
        <div class="col-10 text-weight-bold text-blue-grey-10 q-pb-xs">
          {{ prop.node.label }}
          <q-badge
            v-if="!prop.expanded"
            color="orange"
            class="q-ml-lg text-weight-medium"
            rounded
            floating
            transparent
          >
            {{ prop.node.path ? prop.node.cumulativeTotal : prop.node.total }}
            <q-tooltip v-if="prop.node.total && !prop.node.cumulativeTotal">
              Total email messages
            </q-tooltip>
          </q-badge>
          <q-badge
            v-else
            color="orange"
            class="q-ml-lg"
            rounded
            floating
            transparent
          >
            {{ prop.node.totalIndiv }}
          </q-badge>
        </div>
      </div>
    </template>
  </q-tree>
</template>

<script setup lang="ts">
import { useLeadminerStore } from '@/stores/leadminer';

const leadminerStore = useLeadminerStore();
</script>
=======
<template>
  <Tree
    :value="leadminerStore.boxes"
    :expanded-keys="expandedKeys"
    :selection-keys="leadminerStore.selectedBoxes"
    selection-mode="checkbox"
  >
    <template #default="{ node }">
      {{ node.label }}
      <Badge
        v-if="node.key === '' || node.key! in expandedKeys"
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
>>>>>>> f4d841ab9f10db11448ed46d18f0dec3a7d9d2fa
