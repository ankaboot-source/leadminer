<template>
  <Dialog
    v-model:visible="isVisible"
    modal
    dismissable-mask
    :maximizable="screenStore?.size?.md"
    :pt:root:class="{ 'p-dialog-maximized': !screenStore?.size?.md }"
    :style="{ width: '60vw', height: '70vh' }"
    pt:content:class="grow p-3 border-y border-slate-200"
    pt:footer:class="p-3"
    header="Fine-tune your mining"
  >
    <div class="flex items-center gap-2">
      <div class="text-h6">Select folders to mine</div>
      <Button
        rounded
        outlined
        class="size-8"
        icon="pi pi-refresh"
        :loading="props.isLoadingBoxes"
        :disabled="activeMiningSource === undefined"
        @click="onRefreshImapTree"
      />
      <div class="grow" />

      <Badge v-tooltip="'Email messages selected'" size="large">
        {{ totalEmails.toLocaleString() }}
        <i class="pi pi-envelope ml-1.5" />
      </Badge>
    </div>
    <TreeCard
      v-if="shouldShowTreeCard"
      :class="{ disabled: activeMiningTask }"
    />
    <template #footer>
      <Button label="Save" @click="close" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import TreeCard from '@/components/cards/TreeCard.vue';

const props = defineProps({
  totalEmails: { type: Number, required: true },
  isLoadingBoxes: { type: Boolean, required: true },
});

const $leadminerStore = useLeadminerStore();
const isVisible = ref(false);
const screenStore = useScreenStore();

const activeMiningSource = computed(() => $leadminerStore.activeMiningSource);
const boxes = computed(() => $leadminerStore.boxes);
const shouldShowTreeCard = computed(
  () => boxes.value.length > 0 && !props.isLoadingBoxes
);
const activeMiningTask = computed(
  () => $leadminerStore.miningTask !== undefined
);

async function onRefreshImapTree() {
  try {
    $leadminerStore.isLoadingBoxes = true;
    await $leadminerStore.fetchInbox();
    $leadminerStore.isLoadingBoxes = false;
  } catch (err) {
    $leadminerStore.isLoadingBoxes = false;
    throw err;
  }
}

function open() {
  isVisible.value = true;
}

function close() {
  isVisible.value = false;
}

defineExpose({
  open,
});
</script>
