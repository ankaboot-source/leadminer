<template>
  <Dialog
    v-model:visible="isVisible"
    modal
    :header="modalData?.title"
    :style="{ width: '28rem', maxWidth: '90vw' }"
  >
    <p class="m-0 text-surface-600">
      {{ modalData?.description }}
    </p>
    <template #footer>
      <div class="flex justify-between gap-2">
        <!-- Left side: Cancel button only -->
        <Button
          v-if="cancelButton"
          :label="cancelButton.title"
          link
          @click="handleButtonClick(cancelButton)"
        />

        <!-- Right side: All other buttons -->
        <div class="flex gap-2">
          <Button
            v-for="(button, index) in actionButtons"
            :key="index"
            :label="button.title"
            :outlined="button.variant === 'secondary'"
            :severity="button.variant === 'primary' ? 'contrast' : 'secondary'"
            @click="handleButtonClick(button)"
          />
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
  variant?: 'primary' | 'secondary' | 'ghost';
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
