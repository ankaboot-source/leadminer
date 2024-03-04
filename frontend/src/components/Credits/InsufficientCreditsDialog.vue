<template>
  <q-dialog v-model="showModal">
    <q-card>
      <q-card-section class="q-pr-lg q-pl-lg">
        <div class="row items-center">
          <div class="text-h6 q-ma-none">Oops! Running low on credits 😅</div>
          <!-- Close Button at Top-Right -->
          <div class="q-ml-auto">
            <q-btn
              class="q-pa-sm negative-margin-8"
              flat
              icon="close"
              size="sm"
              color="grey-7"
              @click="closeModal"
            ></q-btn>
          </div>
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section class="q-pa-lg">
        <p class="text-body1 q-ma-none">
          You don't have enough credits to {{ actionType }} all your
          {{ formattedTotal }} {{ engagementType }}.
        </p>
      </q-card-section>
      <q-separator />
      <!-- Buttons -->
      <q-card-actions align="right" class="q-pa-md q-pr-lg q-pl-lg">
        <q-btn
          v-if="showDownloadButton"
          no-caps
          unelevated
          padding="sm md"
          class="secondary-button text-body1"
          :label="downloadActionLabel"
          @click="executePartialAction"
        />
        <q-btn
          no-caps
          unelevated
          padding="sm md"
          color="green"
          class="text-body1"
          label="Refill credits or Upgrade 🚀"
          @click="buyOrUpgrade"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { refillCreditsOrUpgrade } from "src/helpers/credits";
import { computed, ref } from "vue";

const emit = defineEmits(["secondary-action"]);
const { engagementType, actionType } = defineProps<{
  engagementType: string;
  actionType: string;
}>();

const showModal = ref(false);
const showDownloadButton = ref(true);
const total = ref(0);
const available = ref(0);

const formattedTotal = computed(() =>
  new Intl.NumberFormat().format(total.value)
);

const closeModal = () => {
  showModal.value = false;
};
function openModal(totalUnits: number, availableUnits: number) {
  total.value = totalUnits;
  available.value = availableUnits;
  showDownloadButton.value = available.value !== 0;
  showModal.value = true;
}
const executePartialAction = async () => {
  await emit("secondary-action");
  closeModal();
};
const downloadActionLabel = computed(
  () => `${actionType} only ${available.value}`
);
const buyOrUpgrade = () => {
  refillCreditsOrUpgrade();
};

defineExpose({
  openModal,
});
</script>
