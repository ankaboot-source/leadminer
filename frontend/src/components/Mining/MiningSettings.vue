<template>
  <Dialog
    v-model:visible="isVisible"
    modal
    dismissable-mask
    maximizable
    :style="{ width: '60vw', height: '70vh' }"
    pt:content:class="p-0 grow border-y border-slate-200"
    pt:footer:class="p-3"
  >
    <template #header>
      <Button
        icon="pi pi-bars"
        class="p-dialog-header-icon"
        @click="toggleMenu"
      />
      <div class="p-dialog-title">Fine-tune your mining</div>
    </template>

    <div class="flex flex-row h-full">
      <Listbox
        v-model="settingsTab"
        :options="settingsOptions"
        option-value="value"
        class="w-3/12 border-0 rounded-none border-r border-slate-200"
      >
        <template #option="{ option }">
          <div class="flex align-items-center">
            <i :class="option.icon" />
            <span class="ml-2">{{ option.label }}</span>
          </div>
        </template>
      </Listbox>

      <div class="grow p-3">
        <div class="row items-center">
          <div class="text-h6">Select folders to mine</div>
          <Button
            rounded
            icon="pi pi-refresh"
            class="ml-1.5"
            :loading="props.isLoadingBoxes"
            :disabled="activeMiningSource === undefined"
            @click="onRefreshImapTree"
          />
          <div class="grow" />

          <Chip
            v-tooltip="'Email messages selected'"
            class="bg-primary text-white"
          >
            {{ totalEmails }}
            <i class="pi pi-envelope ml-1.5" />
          </Chip>
        </div>
        <Dropdown
          v-if="$leadminerStore.activeMiningSource"
          v-model="$leadminerStore.activeMiningSource.email"
          :options="miningSources"
          option-value="email"
          option-label="email"
          class="mt-3 w-full"
          disabled
          @update:model-value="onMiningSourceChanged"
        />
        <p v-else class="m-0">
          Please ensure you have at least one mining source selected.
        </p>
        <TreeCard
          v-if="shouldShowTreeCard"
          :class="{ disabled: activeMiningTask }"
        />
      </div>
    </div>

    <template #footer>
      <Button label="Save" @click="close" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import TreeCard from '@/components/cards/TreeCard.vue';

const settingsOptions = ref([
  {
    label: 'Mailbox Folders',
    value: 'mailbox_folders',
    icon: 'pi pi-inbox',
  },
]);
const settingsTab = ref(settingsOptions.value[0]);

const props = defineProps({
  totalEmails: { type: Number, required: true },
  isLoadingBoxes: { type: Boolean, required: true },
});

const $leadminerStore = useLeadminerStore();

const isVisible = ref(false);
const menuVisible = ref(true);
const activeMiningSource = computed(() => $leadminerStore.activeMiningSource);
const miningSources = [$leadminerStore.activeMiningSource];

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
    await $leadminerStore.getBoxes();
    $leadminerStore.isLoadingBoxes = false;
  } catch (err) {
    $leadminerStore.isLoadingBoxes = false;
    throw err;
  }
}

function onMiningSourceChanged() {
  onRefreshImapTree();
}

function toggleMenu() {
  menuVisible.value = !menuVisible.value;
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
