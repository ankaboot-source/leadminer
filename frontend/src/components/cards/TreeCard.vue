<template>
  <q-tree
    ref="tree"
    v-model:ticked="leadminerStore.selectedBoxes"
    class="col-10 col-sm-6 q-ma-sm"
    icon="arrow_forward_ios"
    :nodes="leadminerStore.boxes"
    node-key="path"
    color="teal"
    control-color="teal"
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
import { useLeadminerStore } from "src/stores/leadminer";

const leadminerStore = useLeadminerStore();
</script>
