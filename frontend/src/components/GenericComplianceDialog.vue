<template>
  <Dialog v-model:visible="isVisible" modal :header="modalData?.title">
    <p class="m-0">
      {{ modalData?.description }}
    </p>
    <template #footer>
      <div class="flex justify-between gap-4">
        <!-- Left side: Cancel button only -->
        <Button
          v-if="cancelButton"
          :label="cancelButton.title"
          :severity="cancelButton.severity"
          :variant="cancelButton.variant"
          @click="handleButtonClick(cancelButton)"
        />

        <!-- Right side: All other buttons -->
        <div class="flex gap-2">
          <Button
            v-for="(button, index) in actionButtons"
            :key="index"
            :label="button.title"
            :severity="button.severity"
            :variant="button.variant"
            :class="
              button.icon
                ? 'flex space-x-1 items-center justify-center lg:rounded-l-none'
                : ''
            "
            @click="handleButtonClick(button)"
          >
            <template v-if="button.icon" #icon>
              <span class="p-button-icon p-button-icon-right">
                <MdiIcon :icon="button.icon" size="1.3rem" />
              </span>
            </template>
          </Button>
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
export interface ModalButton {
  title: string;
  link?: string;
  action?: string;
  severity?: 'primary' | 'secondary' | 'contrast';
  variant?: 'outlined' | 'text' | 'link';
  icon?: string;
}

export interface ModalData {
  type: 'modal';
  title: string;
  description: string;
  data?: {
    total: number;
    available: number;
    availableAlready: number;
    reason?: string;
  };
  buttons: ModalButton[];
}

const emit = defineEmits<{
  action: [action: string, data?: ModalData['data']];
  close: [];
}>();

const isVisible = ref(false);
const modalData = ref<ModalData | null>(null);

const cancelButton = computed(() => {
  return modalData.value?.buttons.find((b) => b.action === 'cancel');
});

const actionButtons = computed(() => {
  return modalData.value?.buttons.filter((b) => b.action !== 'cancel') ?? [];
});

function openModal(data: ModalData) {
  modalData.value = data;
  isVisible.value = true;
}

function closeModal() {
  isVisible.value = false;
  modalData.value = null;
  emit('close');
}

function handleButtonClick(button: ModalButton) {
  if (button.link) {
    // Open link in new tab or navigate
    if (button.link.startsWith('http')) {
      window.open(button.link, '_blank');
    } else {
      navigateTo(button.link);
    }
    closeModal();
    return;
  }

  if (button.action) {
    if (button.action === 'cancel') {
      closeModal();
      return;
    }

    emit('action', button.action, modalData.value?.data);
    closeModal();
  }
}

defineExpose({
  openModal,
  closeModal,
});
</script>
