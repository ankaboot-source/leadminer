<template>
  <Dialog v-model:visible="showModal" modal :header="t('oops_low_credits')">
    <p class="m-0">
      {{
        t('not_enough_credits', {
          actionType: t(actionType),
          formattedTotal,
          engagementType: t(engagementType, total),
        })
      }}
    </p>
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          v-if="showActionButton"
          outlined
          severity="secondary"
          pt:label:class="capitalize"
          :label="actionLabel"
          @click="executePartialAction"
        />
        <Button
          id="refill-modal"
          :label="t('refill')"
          severity="success"
          @click="refillCredits()"
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
import { refillCredits } from '@/utils/credits';

const { t } = useI18n({
  useScope: 'local',
});

const emit = defineEmits(['secondary-action']);
const { engagementType, actionType } = defineProps<{
  engagementType: 'contact';
  actionType: 'export' | 'enrich';
}>();

const showModal = ref(false);
const showActionButton = ref(true);
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
  availableAlreadyUnits: number,
) {
  total.value = totalUnits;
  available.value = availableUnits;
  availableAlready.value = availableAlreadyUnits;

  showActionButton.value = !hasDeficientCredits;
  showModal.value = true;
}
const executePartialAction = async () => {
  await emit('secondary-action');
  closeModal();
};
const actionLabel = computed(() =>
  t('action_type_only', {
    actionType: t(actionType),
    available: availableAlready.value + available.value,
  }),
);

defineExpose({
  openModal,
});
</script>

<i18n lang="json">
{
  "en": {
    "oops_low_credits": "Oops! Running low on credits 😅",
    "not_enough_credits": "You don't have enough credits to {actionType} your {formattedTotal} {engagementType}.",
    "refill": "Refill credits",
    "action_type_only": "{actionType} only {available}",
    "export": "export",
    "contact": "contact | contacts",
    "enrich": "enrich"
  },
  "fr": {
    "oops_low_credits": "Oups ! Crédits trop bas 😅",
    "not_enough_credits": "Vous n'avez pas assez de crédits pour {actionType} vos {formattedTotal} {engagementType}.",
    "refill": "Recharger vos crédits",
    "action_type_only": "{actionType} seulement {available}",
    "export": "exporter",
    "contact": "contact | contacts",
    "enrich": "enrichir"
  }
}
</i18n>
