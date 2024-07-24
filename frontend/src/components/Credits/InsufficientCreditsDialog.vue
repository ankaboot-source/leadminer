<template>
  <Dialog v-model:visible="showModal" modal :header="t('oops_low_credits')">
    <p class="m-0">
      {{
        t('not_enough_credits', {
          actionType,
          formattedTotal,
          engagementType,
        })
      }}
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
          :label="t('refill_or_upgrade')"
          severity="success"
          @click="buyOrUpgrade"
        >
          <template #icon>
            <span class="p-button-icon p-button-icon-right">🚀</span>
          </template>
        </Button>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { refillCreditsOrUpgrade } from '@/utils/credits';

const { t } = useI18n({
  useScope: 'local',
});

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

const formattedTotal = computed(() => total.value.toLocaleString());

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
const downloadActionLabel = computed(() =>
  t('action_type_only', {
    actionType,
    available: availableAlready.value + available.value,
  })
);
const buyOrUpgrade = () => {
  refillCreditsOrUpgrade();
};

defineExpose({
  openModal,
});
</script>

<i18n lang="json">
{
  "en": {
    "oops_low_credits": "Oops! Running low on credits 😅",
    "not_enough_credits": "You don't have enough credits to {actionType} your {formattedTotal} {engagementType}.",
    "refill_or_upgrade": "Refill credits or Upgrade",
    "action_type_only": "{actionType} only {available}"
  },
  "fr": {
    "oops_low_credits": "Oups ! Crédits en baisse 😅",
    "not_enough_credits": "Vous n'avez pas assez de crédits pour {actionType} tous vos {formattedTotal} {engagementType}.",
    "refill_or_upgrade": "Recharger vos crédits ou Améliorez",
    "action_type_only": "{actionType} seulement {available}"
  }
}
</i18n>
