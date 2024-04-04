<template>
  <Dialog
    v-model:visible="showModal"
    modal
    header="Oops! Running low on credits 😅"
  >
    <p class="m-0">
      You don't have enough credits to {{ actionType }} all your
      {{ formattedTotal }} {{ engagementType }}.
    </p>
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          v-if="showDownloadButton"
          outlined
          severity="secondary"
          pt:label:class="capitalize"
          :label="downloadActionLabel"
          @click="executePartialAction"
        />
        <Button
          label="Refill credits or Upgrade 🚀"
          severity="success"
          @click="buyOrUpgrade"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { refillCreditsOrUpgrade } from '@/utils/credits';

const emit = defineEmits(['secondary-action']);
const { engagementType, actionType } = defineProps<{
  engagementType: string;
  actionType: string;
}>();

const showModal = ref(false);
const showDownloadButton = ref(true);
const total = ref(0);
const available = ref(0);
const availableAlready = ref(0);

const formattedTotal = computed(() =>
  new Intl.NumberFormat().format(total.value)
);

const closeModal = () => {
  showModal.value = false;
};
function openModal(
  hasDeficientCredits: boolean,
  totalUnits: number,
  availableUnits: number,
  availableAlreadyUnits: number
) {
  total.value = totalUnits;
  available.value = availableUnits;
  availableAlready.value = availableAlreadyUnits;

  showDownloadButton.value = !hasDeficientCredits;
  showModal.value = true;
}
const executePartialAction = async () => {
  await emit('secondary-action');
  closeModal();
};
const downloadActionLabel = computed(
  () => `${actionType} only ${availableAlready.value + available.value}`
);
const buyOrUpgrade = () => {
  refillCreditsOrUpgrade();
};

defineExpose({
  openModal,
});
</script>
