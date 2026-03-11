<template>
  <Dialog v-model:visible="isVisible" modal :header="modalData?.title" :style="{ width: '30rem' }">
    <p class="m-0">
      {{ modalData?.description }}
    </p>
    <template #footer>
      <div class="flex justify-end gap-2">
        <!-- All buttons in order (secondary first, primary last) -->
        <Button
          v-for="(button, index) in modalData?.buttons"
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
              <MdiIcon :icon="button.icon as any" size="1.3rem" />
            </span>
          </template>
        </Button>
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
    emit('action', button.action, modalData.value?.data);
    closeModal();
  }
}

defineExpose({
  openModal,
  closeModal,
});
</script>
